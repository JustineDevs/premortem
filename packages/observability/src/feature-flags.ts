import { getPostHogClient, resolvePostHogProjectKey } from './posthog';

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
  if (!resolvePostHogProjectKey()) return defaultValue;

  const posthog = getPostHogClient();
  if (!posthog) return defaultValue;

  try {
    const enabled = await posthog.isFeatureEnabled(flag, distinctId);
    return enabled ?? defaultValue;
  } catch {
    return defaultValue;
  }
}
