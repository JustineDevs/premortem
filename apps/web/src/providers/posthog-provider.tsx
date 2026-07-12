'use client';

import posthog from 'posthog-js';
import { PostHogProvider as PHProvider } from 'posthog-js/react';
import { useEffect, type ReactNode } from 'react';

import { CanonicalEvents } from '@premortem/observability/events';

let initialized = false;

function initPostHog() {
  if (initialized || typeof window === 'undefined') return;

  const key = process.env.NEXT_PUBLIC_POSTHOG_KEY;
  if (!key) {
    throw new Error(
      'PostHog is required. Set NEXT_PUBLIC_POSTHOG_KEY to a phc_ project key before loading the app.'
    );
  }

  posthog.init(key, {
    api_host: process.env.NEXT_PUBLIC_POSTHOG_HOST ?? 'https://us.i.posthog.com',
    capture_pageview: false,
    loaded: (client) => {
      client.register({
        surface: 'reviewer-console'
      });
    },
    persistence: 'localStorage+cookie'
  });
  initialized = true;
}

export function PostHogProvider({ children }: { children: ReactNode }) {
  if (!process.env.NEXT_PUBLIC_POSTHOG_KEY) {
    throw new Error(
      'PostHog is required. Set NEXT_PUBLIC_POSTHOG_KEY to a phc_ project key before loading the app.'
    );
  }

  useEffect(() => {
    initPostHog();
  }, []);

  return <PHProvider client={posthog}>{children}</PHProvider>;
}

export function trackOsEvent(event: string, properties?: Record<string, unknown>) {
  if (typeof window === 'undefined') return;
  posthog.capture(event, properties);
}

export { CanonicalEvents };
