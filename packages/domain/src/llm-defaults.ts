/** Canonical Gemini model for Premortem audits and Rapid Agent validation. */
export const DEFAULT_GEMINI_MODEL = 'gemini-3-flash-preview';

export const SUPPORTED_GEMINI_MODELS = [
  DEFAULT_GEMINI_MODEL,
  'gemini-2.5-flash',
  'gemini-2.5-pro'
] as const;

export type SupportedGeminiModel = (typeof SUPPORTED_GEMINI_MODELS)[number];
