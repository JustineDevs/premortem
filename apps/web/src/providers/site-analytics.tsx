'use client';

import { useEffect, useRef, type ReactNode } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';
import { usePostHog } from 'posthog-js/react';

import { CanonicalEvents } from '@premortem/observability/events';
import { PostHogProvider } from './posthog-provider';

function resolveSurface(pathname: string) {
  if (pathname.startsWith('/app')) return 'reviewer-console';
  if (
    pathname.startsWith('/login') ||
    pathname.startsWith('/signup') ||
    pathname.startsWith('/forgot-password') ||
    pathname.startsWith('/reset-password')
  ) {
    return 'auth';
  }
  return 'marketing';
}

function SurfaceRegistrar() {
  const posthog = usePostHog();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const lastCapturedUrlRef = useRef<string | null>(null);
  const queryString = searchParams?.toString() ?? '';

  useEffect(() => {
    if (!posthog || !pathname) return;
    posthog.register({
      surface: resolveSurface(pathname),
      path: pathname
    });
  }, [pathname, posthog]);

  useEffect(() => {
    if (!pathname) return;
    const key = process.env.NEXT_PUBLIC_POSTHOG_KEY;
    if (!key) {
      throw new Error(
        'PostHog is required. Set NEXT_PUBLIC_POSTHOG_KEY to a phc_ project key before loading the app.'
      );
    }

    const currentUrl = queryString ? `${pathname}?${queryString}` : pathname;
    if (lastCapturedUrlRef.current === currentUrl) return;
    lastCapturedUrlRef.current = currentUrl;

    const captureUrl = (process.env.NEXT_PUBLIC_POSTHOG_HOST ?? 'https://us.i.posthog.com').replace(
      /\/+$/,
      ''
    );

    void fetch(`${captureUrl}/capture/`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json'
      },
      body: JSON.stringify({
        api_key: key,
        distinct_id: currentUrl,
        event: CanonicalEvents.pageViewed,
        properties: {
          $current_url: typeof window !== 'undefined' ? window.location.href : currentUrl,
          surface: resolveSurface(pathname),
          path: pathname,
          query: queryString || undefined,
          title: typeof document !== 'undefined' ? document.title : undefined
        },
        timestamp: new Date().toISOString()
      }),
      mode: 'cors',
      cache: 'no-store'
    }).catch(() => {});
  }, [pathname, queryString]);

  return null;
}

export function SiteAnalytics({ children }: { children: ReactNode }) {
  return (
    <PostHogProvider>
      <SurfaceRegistrar />
      {children}
    </PostHogProvider>
  );
}
