/**
 * Compatibility shim for the historical `@premortem/ingestion` service namespace.
 * The real ingestion implementation lives in `services/orchestrator/src/ingestion`.
 */
export const serviceName = '@premortem/ingestion';

export const ingestionService = {
  kind: 'compatibility-shim' as const,
  purpose: 'Repository ingest is orchestrated by services/orchestrator, not a separate runtime service'
};
