import {
  evaluateAuditMissionQuality,
  evaluateAuditMissionWithLlmJudge,
  isPhoenixEnabled
} from '@premortem/observability/phoenix';

export { evaluateAuditMissionQuality, evaluateAuditMissionWithLlmJudge };

export function isPhoenixLlmEvalEnabled() {
  return isPhoenixEnabled();
}

export const trace = {
  getActiveSpan() {
    return null as { setAttribute(name: string, value: string): void } | null;
  }
};

export function tracePremortemAuditJob<T extends (...args: any[]) => any>(fn: T, options?: unknown): T {
  void options;
  if (!isPhoenixEnabled()) return fn;

  // The lightweight local runtime keeps the live executor synchronous and
  // leaves tracing to the observability layer where supported.
  return fn;
}
