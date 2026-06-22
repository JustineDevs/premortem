/** Canonical Gemini model for Premortem audits and Rapid Agent validation. */
export const DEFAULT_GEMINI_MODEL = 'gemini-3-flash-preview';

/** Canonical Qwen model for OpenAI-compatible audit and synthesis routing. */
export const DEFAULT_QWEN_MODEL = 'qwen-plus';

/** Cheaper Gemini tier for smoke, stress, and eval harnesses. */
export const SMOKE_GEMINI_MODEL = 'gemini-2.5-flash-lite';

export const SUPPORTED_GEMINI_MODELS = [
  DEFAULT_GEMINI_MODEL,
  'gemini-2.5-flash',
  'gemini-2.5-pro'
] as const;

export const SUPPORTED_QWEN_MODELS = [
  DEFAULT_QWEN_MODEL,
  'qwen-max',
  'qwen3-coder-next'
] as const;

export const SUPPORTED_WORKSPACE_MODELS = [
  ...SUPPORTED_GEMINI_MODELS,
  ...SUPPORTED_QWEN_MODELS
] as const;

export type SupportedGeminiModel = (typeof SUPPORTED_GEMINI_MODELS)[number];

export type SupportedWorkspaceModel = (typeof SUPPORTED_WORKSPACE_MODELS)[number];
