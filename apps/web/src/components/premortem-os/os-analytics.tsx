'use client';

import posthog from 'posthog-js';
import { usePathname, useSearchParams } from 'next/navigation';
import { useEffect } from 'react';

import { CanonicalEvents } from '@/lib/canonical/events';
import type { WorkspaceBundle } from '@/hooks/workspace-types';

export function OsAnalyticsIdentity({ workspace }: { workspace?: WorkspaceBundle | null }) {
  useEffect(() => {
    if (!process.env.NEXT_PUBLIC_POSTHOG_KEY || !workspace) return;

    posthog.identify(workspace.profile.id, {
      email: workspace.profile.email,
      name: workspace.profile.fullName,
      organization_id: workspace.organization.id,
      organization_slug: workspace.organization.slug,
      plan: workspace.billing.plan
    });

    posthog.group('organization', workspace.organization.id, {
      name: workspace.organization.name,
      plan: workspace.billing.plan,
      project_count: workspace.organization.projectCount
    });
  }, [workspace]);

  return null;
}

export function OsPageAnalytics() {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  useEffect(() => {
    if (!process.env.NEXT_PUBLIC_POSTHOG_KEY || !pathname) return;

    const query = searchParams?.toString();
    posthog.capture(CanonicalEvents.pageViewed, {
      $current_url: query ? `${pathname}?${query}` : pathname,
      surface: 'reviewer-console'
    });
  }, [pathname, searchParams]);

  return null;
}
