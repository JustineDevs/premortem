import { createOpenAI } from '@ai-sdk/openai';

const QWEN_TOKEN_PLAN_BASE_URL =
  'https://token-plan.ap-southeast-1.maas.aliyuncs.com/compatible-mode/v1';
const QWEN_PAYG_BASE_URL = 'https://dashscope-intl.aliyuncs.com/compatible-mode/v1';

export type QwenKeyMode = 'pay-as-you-go' | 'token-plan';

export function readQwenApiKey(env = process.env): string {
  return env.QWEN_API_KEY?.trim() || env.DASHSCOPE_API_KEY?.trim() || '';
}

export function resolveQwenKeyMode(apiKey: string): QwenKeyMode {
  return apiKey.startsWith('sk-sp-') ? 'token-plan' : 'pay-as-you-go';
}

export function isTokenPlanQwenKey(apiKey: string): boolean {
  return resolveQwenKeyMode(apiKey) === 'token-plan';
}

export function resolveQwenCompatibleBaseUrl(env = process.env): string {
  const apiKey = readQwenApiKey(env);
  const explicitBaseUrl = env.QWEN_BASE_URL?.trim() || env.DASHSCOPE_BASE_URL?.trim() || '';
  const normalizedExplicitBaseUrl = explicitBaseUrl
    ? normalizeCompatibleBaseUrl(explicitBaseUrl)
    : '';
  const isTokenPlanKey = isTokenPlanQwenKey(apiKey);

  if (normalizedExplicitBaseUrl) {
    if (isTokenPlanKey && !isTokenPlanCompatibleBaseUrl(normalizedExplicitBaseUrl)) {
      throw new Error(
        'QWEN_API_KEY starts with sk-sp-, so the Qwen base URL must target the Token Plan endpoint: https://token-plan.ap-southeast-1.maas.aliyuncs.com/compatible-mode/v1'
      );
    }

    if (!isTokenPlanKey && isTokenPlanCompatibleBaseUrl(normalizedExplicitBaseUrl)) {
      throw new Error(
        'Qwen API key is not a Token Plan key, but the configured base URL targets the Token Plan endpoint. Use the public DashScope endpoint or provide a Token Plan key.'
      );
    }

    return normalizedExplicitBaseUrl;
  }

  return isTokenPlanKey ? QWEN_TOKEN_PLAN_BASE_URL : QWEN_PAYG_BASE_URL;
}

export function createQwenCompatibleClient(env = process.env) {
  const apiKey = readQwenApiKey(env);
  if (!apiKey) {
    throw new Error('QWEN_API_KEY or DASHSCOPE_API_KEY is required for the Qwen model provider.');
  }

  return createOpenAI({
    apiKey,
    baseURL: resolveQwenCompatibleBaseUrl(env)
  });
}

export function createQwenPayAsYouGoClient(env = process.env) {
  const apiKey = readQwenApiKey(env);
  if (!apiKey) {
    throw new Error('QWEN_API_KEY or DASHSCOPE_API_KEY is required for the Qwen model provider.');
  }

  if (resolveQwenKeyMode(apiKey) !== 'pay-as-you-go') {
    throw new Error(
      'createQwenPayAsYouGoClient requires a pay-as-you-go Qwen key such as sk-ws-...'
    );
  }

  return createOpenAI({
    apiKey,
    baseURL: QWEN_PAYG_BASE_URL
  });
}

function normalizeCompatibleBaseUrl(baseUrl: string): string {
  return baseUrl.trim().replace(/\/$/, '').endsWith('/v1')
    ? baseUrl.trim().replace(/\/$/, '')
    : `${baseUrl.trim().replace(/\/$/, '')}/v1`;
}

function isTokenPlanCompatibleBaseUrl(baseUrl: string): boolean {
  return baseUrl.includes('token-plan.ap-southeast-1.maas.aliyuncs.com');
}
