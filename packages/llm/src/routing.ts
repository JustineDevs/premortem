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
  google: 'gemini-3-flash-preview',
  openai: 'gpt-5.4',
  anthropic: 'claude-sonnet-4.6',
  qwen: 'qwen-plus'
};

function normalizeUrl(value: string) {
  return value.trim().replace(/\/$/, '');
}

function resolveDefaultProvider(model: string, defaultProvider: LlmProvider) {
  const trimmed = model.trim();
  if (!trimmed) {
    return {
      provider: defaultProvider,
      model: DEFAULT_MODEL_BY_PROVIDER[defaultProvider]
    };
  }

  const prefixed = trimmed.match(/^(google|openai|anthropic|qwen)\/(.+)$/);
  if (prefixed) {
    return {
      provider: prefixed[1] as LlmProvider,
      model: prefixed[2]
    };
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

  if (routing.length === 0) {
    addManaged('Managed vendor primary');
    for (const provider of customProviders) {
      addCustomProvider(provider, `Local / hybrid provider: ${provider.name}`);
    }
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

  if (targets.length === 0) {
    addManaged('Managed vendor fallback');
    for (const provider of customProviders) {
      addCustomProvider(provider, `Local / hybrid provider: ${provider.name}`);
    }
  }

  return targets;
}

export function isLlmProviderTargetUsable(target: LlmProviderTarget, env = process.env): boolean {
  if (target.provider === 'google') {
    return Boolean(env.GEMINI_API_KEY?.trim());
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
