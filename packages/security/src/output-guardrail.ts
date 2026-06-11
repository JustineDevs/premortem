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
