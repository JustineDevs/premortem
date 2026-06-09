import { AzureOpenAIAdapter } from './azure-openai';
import { GeminiAdapter } from './gemini';
import type { LlmAdapter } from './types';

export function createLlmAdapter(): LlmAdapter {
  if (process.env.GEMINI_API_KEY) {
    return new GeminiAdapter(process.env.GEMINI_API_KEY);
  }

  if (process.env.AZURE_OPENAI_ENDPOINT && process.env.AZURE_OPENAI_API_KEY) {
    return new AzureOpenAIAdapter(process.env.AZURE_OPENAI_ENDPOINT, process.env.AZURE_OPENAI_API_KEY);
  }

  throw new Error('No LLM adapter configured. Set GEMINI_API_KEY or AZURE_OPENAI_* env vars.');
}
