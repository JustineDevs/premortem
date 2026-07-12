import { hasConfiguredRuntimeCredentials } from '@premortem/domain';
import { discoverLocalLlmProviders, type DiscoveredLocalLlmProvider } from '../../packages/llm/src/local-llm-discovery.ts';

export interface DevLlmRuntimeState {
  hasRealLlm: boolean;
  discoveredLocalProviders: DiscoveredLocalLlmProvider[];
}

export async function resolveDevLlmRuntimeState(): Promise<DevLlmRuntimeState> {
  const discoveredLocalProviders = await discoverLocalLlmProviders();
  return {
    discoveredLocalProviders,
    hasRealLlm: hasConfiguredRuntimeCredentials(process.env) || discoveredLocalProviders.length > 0
  };
}

