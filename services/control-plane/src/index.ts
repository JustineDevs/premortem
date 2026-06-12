/**
 * Compatibility shim for the historical control-plane namespace.
 * The runtime control paths are implemented in `apps/api` and `services/orchestrator`.
 */
export const controlPlane = {
  kind: 'compatibility-shim' as const,
  features: ['queueing', 'leasing', 'idempotency', 'dead-letter-routing']
};
