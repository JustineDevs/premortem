/**
 * Compatibility shim for the historical review namespace.
 * The actual reviewer workflow is implemented in `apps/web/app/(os)/app` and
 * `services/orchestrator`.
 */
export const reviewService = {
  kind: 'compatibility-shim' as const,
  capabilities: ['diffs', 'edit-history', 'version-compare', 'approve', 'reject', 'publish-confirmation']
};
