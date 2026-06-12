/**
 * Compatibility shim for the historical repo-ingestion namespace.
 * Real ingestion is owned by `services/orchestrator/src/ingestion`.
 */
export const repoIngestion = {
  kind: 'compatibility-shim' as const,
  stages: ['clone', 'tree-scan', 'ci-scan', 'docs-scan', 'history-scan', 'graph-extract']
};
