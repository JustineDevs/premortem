import type { ZodType } from 'zod';

export type LlmProvider = 'google' | 'openai' | 'anthropic' | 'qwen';

export interface LlmMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface LlmGenerateInput {
  model: string;
  messages: LlmMessage[];
  temperature?: number;
  maxOutputTokens?: number;
}

export interface LlmGenerateOutput {
  text: string;
  raw: unknown;
}

export interface LlmGenerateObjectOutput<T> {
  output: T;
  raw: unknown;
}

export interface LlmAdapter {
  provider: LlmProvider;
  generate(input: LlmGenerateInput): Promise<LlmGenerateOutput>;
  generateObject<T>(input: LlmGenerateObjectInput<T>): Promise<LlmGenerateObjectOutput<T>>;
}

export interface LlmCustomProviderConfig {
  name: string;
  host: string;
  model: string;
  active: boolean;
}

export type LlmVendorRoutingKind = 'managed' | 'custom' | 'auto_discover';

export interface LlmVendorRoutingTierConfig {
  id: string;
  label: string;
  description: string;
  kind: LlmVendorRoutingKind;
  providerRef: string;
  enabled: boolean;
}

export interface LlmProviderTarget {
  provider: LlmProvider;
  model: string;
  label: string;
  kind: LlmVendorRoutingKind | 'fallback';
  baseUrl?: string;
  providerRef?: string;
}

export interface UnifiedLlmAdapterOptions {
  vendorRouting?: LlmVendorRoutingTierConfig[];
  customProviders?: LlmCustomProviderConfig[];
}

export interface LlmGenerateObjectInput<T> extends LlmGenerateInput {
  schema: ZodType<T>;
}
