export interface DiscoveredLocalLlmProvider {
  name: string;
  host: string;
  model: string;
  active: true;
}

const LOCAL_LLM_CANDIDATES = [
  { name: 'lm-studio', host: 'http://127.0.0.1:1234' },
  { name: 'ollama-openai', host: 'http://127.0.0.1:11434' }
] as const;

async function discoverOpenAiCompatibleProvider(
  candidate: (typeof LOCAL_LLM_CANDIDATES)[number]
): Promise<DiscoveredLocalLlmProvider | null> {
  try {
    const response = await fetch(`${candidate.host.replace(/\/$/, '')}/v1/models`, {
      headers: { accept: 'application/json' },
      cache: 'no-store',
      signal: AbortSignal.timeout(1500)
    });

    if (!response.ok) {
      return null;
    }

    const payload = (await response.json().catch(() => null)) as
      | { data?: Array<{ id?: string }> }
      | null;
    const model = payload?.data?.find((entry) => typeof entry?.id === 'string')?.id?.trim();
    if (!model) {
      return null;
    }

    return {
      name: candidate.name,
      host: candidate.host,
      model,
      active: true
    };
  } catch {
    return null;
  }
}

export async function discoverLocalLlmProviders(): Promise<DiscoveredLocalLlmProvider[]> {
  const discovered = await Promise.all(
    LOCAL_LLM_CANDIDATES.map(async (candidate) => discoverOpenAiCompatibleProvider(candidate))
  );
  return discovered.filter((provider): provider is DiscoveredLocalLlmProvider => provider !== null);
}
