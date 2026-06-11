const FORBIDDEN_TERMS = [
  'ignore instructions',
  'ignore previous',
  'ignore all',
  'disregard instructions',
  'disregard previous',
  'forget everything',
  'forget your instructions',
  'system_override',
  'system override',
  'override system',
  'bypass',
  'jailbreak',
  'new instructions',
  'you are now',
  'pretend you are',
  'act as if',
  'developer mode',
  'dan mode',
  'do anything now',
  'reveal your prompt',
  'show your prompt',
  'repeat your instructions',
  'output your system prompt',
  'what are your instructions',
  'drop table',
  'drop database',
  'delete all',
  'delete database',
  'truncate table',
  'exec(',
  'eval(',
  'execute(',
  'rm -rf',
  'format c:'
] as const;

const FORBIDDEN_PATTERNS = [
  /<system[^>]*>[\s\S]*?<\/system>/i,
  /\[INST\][\s\S]*?\[\/INST\]/i,
  /```system\b/i
];

function normalize(text: string): string {
  return text
    .normalize('NFKC')
    .replace(/[\u200B-\u200D\uFEFF\u2060-\u206F]/g, '');
}

export interface GuardrailResult {
  passed: boolean;
  violation?: string;
}

export function validateInput(prompt: string): GuardrailResult {
  if (!prompt || typeof prompt !== 'string') {
    return { passed: false, violation: 'Empty or invalid input' };
  }

  const text = normalize(prompt.trim());
  if (!text) return { passed: false, violation: 'Empty input' };

  const lower = text.toLowerCase();
  for (const term of FORBIDDEN_TERMS) {
    if (lower.includes(term)) {
      return { passed: false, violation: 'Input contains prohibited content' };
    }
  }

  for (const pattern of FORBIDDEN_PATTERNS) {
    if (pattern.test(text)) {
      return { passed: false, violation: 'Input contains prohibited content' };
    }
  }

  return { passed: true };
}

export function validateInputOrThrow(prompt: string): void {
  const result = validateInput(prompt);
  if (!result.passed) {
    throw new Error(result.violation ?? 'Security policy violation');
  }
}
