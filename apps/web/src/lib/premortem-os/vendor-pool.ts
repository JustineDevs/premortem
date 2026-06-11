export type VendorTierKind = 'managed' | 'custom' | 'auto_discover';

export interface VendorRoutingTier {
  id: string;
  label: string;
  description: string;
  kind: VendorTierKind;
  providerRef: string;
  enabled: boolean;
}

export const DEFAULT_VENDOR_ROUTING: VendorRoutingTier[] = [
  {
    id: 'boost',
    label: 'Boost Tier',
    description: 'Low-latency custom endpoint for fast specialist passes.',
    kind: 'custom',
    providerRef: '',
    enabled: false
  },
  {
    id: 'primary',
    label: 'Primary Tier',
    description: 'Managed Gemini models for synthesis and deep reasoning.',
    kind: 'managed',
    providerRef: 'gemini',
    enabled: true
  },
  {
    id: 'fallback',
    label: 'Auto-Discover',
    description: 'Probe local Ollama, LM Studio, and compatible OpenAI proxies.',
    kind: 'auto_discover',
    providerRef: 'local',
    enabled: true
  }
];

export function normalizeVendorRouting(
  value: unknown,
  customProviderNames: string[] = []
): VendorRoutingTier[] {
  if (!Array.isArray(value) || value.length === 0) {
    return DEFAULT_VENDOR_ROUTING.map((tier) => ({ ...tier }));
  }

  return value.map((entry, index) => {
    const row = entry && typeof entry === 'object' ? (entry as Record<string, unknown>) : {};
    const fallback = DEFAULT_VENDOR_ROUTING[index] ?? DEFAULT_VENDOR_ROUTING[DEFAULT_VENDOR_ROUTING.length - 1]!;
    const kind =
      row.kind === 'managed' || row.kind === 'custom' || row.kind === 'auto_discover'
        ? row.kind
        : fallback.kind;

    let providerRef =
      typeof row.providerRef === 'string' ? row.providerRef : fallback.providerRef;

    if (kind === 'custom' && providerRef && !customProviderNames.includes(providerRef)) {
      providerRef = customProviderNames[0] ?? '';
    }

    return {
      id: typeof row.id === 'string' ? row.id : fallback.id,
      label: typeof row.label === 'string' ? row.label : fallback.label,
      description: typeof row.description === 'string' ? row.description : fallback.description,
      kind,
      providerRef,
      enabled: typeof row.enabled === 'boolean' ? row.enabled : fallback.enabled
    };
  });
}
