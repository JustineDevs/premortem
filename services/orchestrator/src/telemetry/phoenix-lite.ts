import {
  evaluateAuditMissionQuality,
  evaluateAuditMissionWithLlmJudge,
  isPhoenixEnabled,
  trace
} from '@premortem/observability/phoenix';

export { evaluateAuditMissionQuality, evaluateAuditMissionWithLlmJudge };
export { trace };

export function isPhoenixLlmEvalEnabled() {
  return isPhoenixEnabled();
}

export function tracePremortemAuditJob<T extends (...args: any[]) => any>(fn: T, options?: unknown): T {
  void options;
  if (!isPhoenixEnabled()) {
    throw new Error(
      'Phoenix is required for audit tracing. Set PHOENIX_API_KEY or PHOENIX_COLLECTOR_ENDPOINT.'
    );
  }

  return fn;
}
