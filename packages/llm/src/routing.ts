import { DEFAULT_QWEN_MODEL } from '@premortem/domain';
import type {
  LlmCustomProviderConfig,
  LlmProvider,
  LlmProviderTarget,
  LlmVendorRoutingTierConfig
} from './types';

export interface ResolveLlmProviderTargetsInput {
  model: string;
  defaultProvider?: LlmProvider;
  vendorRouting?: LlmVendorRoutingTierConfig[];
  customProviders?: LlmCustomProviderConfig[];
}

const DEFAULT_MODEL_BY_PROVIDER: Record<LlmProvider, string> = {
  google: 'gemini-2.5-flash',
  openai: 'gpt-5.4',
  anthropic: 'claude-sonnet-4.6',
  qwen: DEFAULT_QWEN_MODEL,
  openrouter: 'google/gemini-2.5-flash'
};

function splitPrefixedModelId(model: string): { provider: LlmProvider; model: string } | null {
  const trimmed = model.trim();
  const prefixed = trimmed.match(/^(google|openai|anthropic|qwen|openrouter)(:|\/)(.+)$/);
  if (!prefixed) return null;
  return {
    provider: prefixed[1] as LlmProvider,
    model: prefixed[3]
  };
}

function normalizeUrl(value: string) {
  return value.trim().replace(/\/$/, '');
}

function resolveDefaultProvider(
  model: string,
  defaultProvider: LlmProvider
): { provider: LlmProvider; model: string } {
  const trimmed = model.trim();
  if (!trimmed) {
    return {
      provider: defaultProvider,
      model: DEFAULT_MODEL_BY_PROVIDER[defaultProvider]
    };
  }

  const prefixed = splitPrefixedModelId(trimmed);
  if (prefixed) {
    if (defaultProvider === 'openrouter' && prefixed.provider !== 'openrouter') {
      return {
        provider: 'openrouter',
        model: trimmed
      };
    }
    const modelSlug = prefixed.provider === 'openrouter' && !prefixed.model.includes('/')
      ? `openrouter/${prefixed.model}`
      : prefixed.model;
    return {
      provider: prefixed.provider,
      model: modelSlug
    };
  }

  if (defaultProvider === 'openrouter') {
    if (
      trimmed.startsWith('gemini-') ||
      trimmed.startsWith('gemma-') ||
      trimmed.startsWith('google-')
    ) {
      return { provider: 'openrouter' as const, model: `google/${trimmed}` };
    }

    if (trimmed.startsWith('gpt-') || trimmed.startsWith('o1') || trimmed.startsWith('o3')) {
      return { provider: 'openrouter' as const, model: `openai/${trimmed}` };
    }

    if (trimmed.startsWith('claude-')) {
      return { provider: 'openrouter' as const, model: `anthropic/${trimmed}` };
    }

    if (trimmed.startsWith('qwen') || trimmed.startsWith('qwq-')) {
      return { provider: 'openrouter' as const, model: `qwen/${trimmed}` };
    }
  }

  if (
    trimmed.startsWith('gemini-') ||
    trimmed.startsWith('gemma-') ||
    trimmed.startsWith('google-')
  ) {
    return { provider: 'google' as const, model: trimmed };
  }

  if (trimmed.startsWith('gpt-') || trimmed.startsWith('o1') || trimmed.startsWith('o3')) {
    return { provider: 'openai' as const, model: trimmed };
  }

  if (trimmed.startsWith('claude-')) {
    return { provider: 'anthropic' as const, model: trimmed };
  }

  if (trimmed.startsWith('qwen') || trimmed.startsWith('qwq-')) {
    return { provider: 'qwen' as const, model: trimmed };
  }

  return { provider: defaultProvider, model: trimmed };
}

function pushUnique(targets: LlmProviderTarget[], candidate: LlmProviderTarget) {
  const duplicate = targets.some(
    (entry) =>
      entry.provider === candidate.provider &&
      entry.model === candidate.model &&
      (entry.baseUrl ?? '') === (candidate.baseUrl ?? '') &&
      entry.kind === candidate.kind
  );
  if (!duplicate) {
    targets.push(candidate);
  }
}

export function resolveLlmProviderTargets(
  input: ResolveLlmProviderTargetsInput
): LlmProviderTarget[] {
  const defaultProvider = input.defaultProvider ?? 'google';
  const managed = resolveDefaultProvider(input.model, defaultProvider);
  const customProviders = (input.customProviders ?? []).filter(
    (provider) =>
      provider.active &&
      provider.name.trim().length > 0 &&
      provider.host.trim().length > 0 &&
      provider.model.trim().length > 0
  );
  const targets: LlmProviderTarget[] = [];
  const routing = (input.vendorRouting ?? []).filter((tier) => tier.enabled);

  const addManaged = (label = 'Managed vendor') => {
    pushUnique(targets, {
      provider: managed.provider,
      model: managed.model,
      label,
      kind: 'managed'
    });
  };

  const addManagedFallbacks = (labelPrefix = 'Managed fallback') => {
    const fallbackProviders: LlmProvider[] = ['google', 'openai', 'qwen', 'anthropic'];
    for (const provider of fallbackProviders) {
      if (provider === managed.provider) continue;
      const candidate: LlmProviderTarget = {
        provider,
        model: DEFAULT_MODEL_BY_PROVIDER[provider],
        label: `${labelPrefix} · ${provider}`,
        kind: 'managed'
      };
      if (!isLlmProviderTargetUsable(candidate)) {
        continue;
      }
      pushUnique(targets, candidate);
    }
  };

  const addCustomProvider = (provider: LlmCustomProviderConfig, label: string) => {
    pushUnique(targets, {
      provider: 'openai',
      model: provider.model,
      label,
      kind: 'custom',
      baseUrl: normalizeUrl(provider.host),
      providerRef: provider.name
    });
  };

  const addUniversalLocalFallbacks = (labelPrefix = 'Local fallback') => {
    for (const provider of customProviders) {
      addCustomProvider(provider, `${labelPrefix} · ${provider.name}`);
    }
  };

  if (routing.length === 0) {
    addUniversalLocalFallbacks('Local / hybrid provider');
    addManaged('Managed vendor primary');
    addManagedFallbacks('Managed fallback');
    return targets;
  }

  for (const tier of routing) {
    if (tier.kind === 'managed') {
      const providerLabel = tier.providerRef.trim() || 'managed';
      addManaged(`${tier.label} · ${providerLabel}`);
      continue;
    }

    if (tier.kind === 'custom') {
      const selected = customProviders.find((provider) => provider.name === tier.providerRef);
      if (selected) {
        addCustomProvider(selected, `${tier.label} · ${selected.name}`);
      }
      continue;
    }

    if (tier.kind === 'auto_discover') {
      for (const provider of customProviders) {
        addCustomProvider(provider, `${tier.label} · ${provider.name}`);
      }
    }
  }

  addUniversalLocalFallbacks('Local / hybrid provider');
  addManagedFallbacks('Managed fallback');

  if (targets.length === 0) {
    addManaged('Managed vendor fallback');
  }

  return targets;
}

export function isLlmProviderTargetUsable(target: LlmProviderTarget, env = process.env): boolean {
  if (target.provider === 'google') {
    return Boolean(env.GEMINI_API_KEY?.trim());
  }

  if (target.provider === 'openrouter') {
    return Boolean(env.OPENROUTER_API_KEY?.trim() || env.OPEN_ROUTER_API_KEY?.trim());
  }

  if (target.provider === 'openai') {
    return target.baseUrl ? target.baseUrl.trim().length > 0 : Boolean(env.OPENAI_API_KEY?.trim());
  }

  if (target.provider === 'anthropic') {
    return Boolean(env.ANTHROPIC_API_KEY?.trim());
  }

  if (target.provider === 'qwen') {
    return Boolean(env.QWEN_API_KEY?.trim() || env.DASHSCOPE_API_KEY?.trim());
  }

  return false;
}
