const SENSITIVE_PATTERNS: RegExp[] = [
  /sk-[A-Za-z0-9]{20,}/g,
  /Bearer [A-Za-z0-9\-._~+/]+=*/g,
  /password\s*[:=]\s*\S+/gi,
  /secret\s*[:=]\s*\S+/gi,
  /-----BEGIN [A-Z ]+PRIVATE KEY-----/g
];

export function scrubOutput(text: string): string {
  let result = text;
  for (const pattern of SENSITIVE_PATTERNS) {
    result = result.replace(pattern, '[REDACTED]');
  }
  return result;
}

export function validateFindingCompleteness(finding: unknown): string[] {
  const errors: string[] = [];
  if (!finding || typeof finding !== 'object') return ['finding must be an object'];

  const f = finding as Record<string, unknown>;
  if (!f.evidence || !Array.isArray(f.evidence) || f.evidence.length < 2) {
    errors.push('min_evidence_refs: 2 not met');
  }

  if (
    !f.reasoning ||
    typeof f.reasoning !== 'object' ||
    typeof (f.reasoning as Record<string, unknown>).hypothesis !== 'string'
  ) {
    errors.push('reasoning.hypothesis is required');
  }

  if (!f.predicted_outcome) {
    errors.push('predicted_outcome is required');
  }

  return errors;
}
