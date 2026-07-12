'use client';

import { useEffect } from 'react';
import { usePostHog } from 'posthog-js/react';

import type { WorkspaceBundle } from '@/hooks/workspace-types';

export function OsAnalyticsIdentity({ workspace }: { workspace?: WorkspaceBundle | null }) {
  const posthog = usePostHog();

  useEffect(() => {
    if (!workspace) return;
    if (!posthog) {
      throw new Error(
        'PostHog is required for reviewer console analytics. Ensure NEXT_PUBLIC_POSTHOG_KEY is configured.'
      );
    }

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

    posthog.register({
      surface: 'reviewer-console'
    });
  }, [posthog, workspace]);

  return null;
}
