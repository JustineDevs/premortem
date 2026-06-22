const COMMENT_AND_MARKDOWN_PATTERNS: RegExp[] = [
  /<!--[\s\S]*?-->/g,
  /\/\*[\s\S]*?\*\//g,
  /^\s*\/\/.*$/gm,
  /^\s*#.*$/gm,
  /^\s*\*.*$/gm,
  /^\s*>\s*.*$/gm,
  /```[a-z-]*\n?/gi,
  /```/g
];

function normalizeText(value: string): string {
  return value.normalize('NFKC').replace(/[\u200B-\u200D\uFEFF\u2060-\u206F]/g, '');
}

/**
 * Remove common prompt-injection surfaces from code and markdown text before it reaches an LLM.
 *
 * The sanitizer strips comments, markdown fences, and other non-code prose while leaving the
 * structural code content intact for grounding.
 */
export function stripPromptInjectionSurface(text: string): string {
  let result = normalizeText(text);
  for (const pattern of COMMENT_AND_MARKDOWN_PATTERNS) {
    result = result.replace(pattern, '');
  }
  return result.replace(/\n{3,}/g, '\n\n').trim();
}

function shouldSanitizeValue(key: string): boolean {
  return /(?:^|_|\.)(?:body|content|description|docs?|markdown|message|note|preview|readme|text|summary)$/i.test(
    key
  );
}

function sanitizeValue(value: unknown): unknown {
  if (typeof value === 'string') {
    return stripPromptInjectionSurface(value);
  }

  if (Array.isArray(value)) {
    return value.map((entry) => sanitizeValue(entry));
  }

  if (!value || typeof value !== 'object') {
    return value;
  }

  const record = value as Record<string, unknown>;
  const sanitized: Record<string, unknown> = {};
  for (const [key, entry] of Object.entries(record)) {
    sanitized[key] = shouldSanitizeValue(key) ? sanitizeValue(entry) : sanitizeValue(entry);
  }
  return sanitized;
}

/**
 * Deep-sanitize a prompt payload so nested docs, comments, and markdown text do not reach the model unchanged.
 */
export function sanitizePromptPayload<T>(payload: T): T {
  return sanitizeValue(payload) as T;
}
