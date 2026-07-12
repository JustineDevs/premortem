import { getPostHogClient } from './posthog';

/** Canonical feature flags: create matching flags in PostHog. */
export const CanonicalFeatureFlags = {
  workflowCanvas: 'workflow-canvas',
  adHocSandbox: 'ad-hoc-sandbox',
  stripeBilling: 'stripe-billing',
  gitlabReconcile: 'gitlab-reconcile'
} as const;

export async function isFeatureEnabled(
  distinctId: string,
  flag: string,
  defaultValue = false
): Promise<boolean> {
  const posthog = getPostHogClient();
  const enabled = await posthog.isFeatureEnabled(flag, distinctId);
  return enabled ?? defaultValue;
}
