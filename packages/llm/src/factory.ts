import { UnifiedLlmAdapter } from './client';
import type { LlmAdapter, UnifiedLlmAdapterOptions } from './types';

export function createLlmAdapter(options?: UnifiedLlmAdapterOptions): LlmAdapter {
  return new UnifiedLlmAdapter(undefined, options);
}
