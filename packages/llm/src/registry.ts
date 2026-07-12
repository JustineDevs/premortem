import { createProviderRegistry } from 'ai';
import { createAnthropic } from '@ai-sdk/anthropic';
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { createOpenAI } from '@ai-sdk/openai';
import { createOpenRouter } from '@openrouter/ai-sdk-provider';

import { createQwenCompatibleClient } from './qwen';

function createLazyQwenProvider(env = process.env) {
  return {
    specificationVersion: 'v3' as const,
    languageModel(modelId: string) {
      return createQwenCompatibleClient(env).languageModel(modelId);
    },
    embeddingModel(modelId: string) {
      throw new Error(`No Qwen embedding model is available for ${modelId}`);
    },
    imageModel(modelId: string) {
      throw new Error(`No Qwen image model is available for ${modelId}`);
    },
    transcriptionModel(modelId: string) {
      throw new Error(`No Qwen transcription model is available for ${modelId}`);
    },
    speechModel(modelId: string) {
      throw new Error(`No Qwen speech model is available for ${modelId}`);
    },
    rerankingModel(modelId: string) {
      throw new Error(`No Qwen reranking model is available for ${modelId}`);
    }
  };
}

function createPremortemProviderRegistry(env = process.env) {
  return createProviderRegistry(
    {
      google: createGoogleGenerativeAI({ apiKey: env.GEMINI_API_KEY?.trim() || undefined }),
      openai: createOpenAI({ apiKey: env.OPENAI_API_KEY?.trim() || undefined }),
      anthropic: createAnthropic({ apiKey: env.ANTHROPIC_API_KEY?.trim() || undefined }),
      openrouter: createOpenRouter({ apiKey: env.OPENROUTER_API_KEY?.trim() || env.OPEN_ROUTER_API_KEY?.trim() || undefined }),
      qwen: createLazyQwenProvider(env)
    },
    { separator: ':' }
  );
}

export const premortemProviderRegistry = createPremortemProviderRegistry();
