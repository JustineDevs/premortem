/** Canonical Gemini model for backend runtime calls that still use provider-native IDs. */
export const DEFAULT_GEMINI_MODEL = 'gemini-2.5-flash';

/** Cheaper Gemini tier for smoke, stress, and eval harnesses. */
export const SMOKE_GEMINI_MODEL = 'gemini-2.5-flash-lite';

/** Canonical workspace model ID for the default managed Gemini route. */
export const DEFAULT_WORKSPACE_GEMINI_MODEL = 'google:gemini-2.5-flash';

/** Canonical workspace model ID for the smoke and stress route. */
export const SMOKE_WORKSPACE_GEMINI_MODEL = 'google:gemini-2.5-flash-lite';

/** Legacy model aliases we still accept on read, but normalize away on write. */
export const LEGACY_GEMINI_MODEL_ALIASES = ['gemini-3-flash-preview'] as const;

/** Canonical Qwen model for OpenAI-compatible audit and synthesis routing. */
export const DEFAULT_QWEN_MODEL = 'qwen-plus';

/** Canonical workspace model ID for the managed Qwen route. */
export const DEFAULT_WORKSPACE_QWEN_MODEL = 'qwen:qwen-plus';

/** Provider ids exposed in workspace model selectors and persistence. */
export const WORKSPACE_MODEL_PROVIDERS = ['google', 'openai', 'anthropic', 'qwen', 'openrouter'] as const;

export const SUPPORTED_GEMINI_MODELS = [
  DEFAULT_GEMINI_MODEL,
  SMOKE_GEMINI_MODEL,
  'gemini-2.5-pro'
] as const;

export const SUPPORTED_QWEN_MODELS = [
  DEFAULT_WORKSPACE_QWEN_MODEL,
  'qwen:qwen-max',
  'qwen:qwen3-coder-next'
] as const;

export const SUPPORTED_WORKSPACE_MODELS = [
  ...SUPPORTED_GEMINI_MODELS,
  ...SUPPORTED_QWEN_MODELS
] as const;

export type SupportedGeminiModel = (typeof SUPPORTED_GEMINI_MODELS)[number];

export type SupportedWorkspaceModel =
  | (typeof SUPPORTED_WORKSPACE_MODELS)[number]
  | `openrouter:${string}`
  | `openrouter/${string}`
  | `google:${string}`
  | `google/${string}`
  | `openai:${string}`
  | `openai/${string}`
  | `anthropic:${string}`
  | `anthropic/${string}`
  | `qwen:${string}`
  | `qwen/${string}`;

function canonicalWorkspaceModel(model: string): SupportedWorkspaceModel {
  const trimmed = model.trim();
  const prefixed = trimmed.match(/^(google|openai|anthropic|qwen|openrouter)(:|\/)(.+)$/);
  if (prefixed) {
    return `${prefixed[1]}:${prefixed[3]}` as SupportedWorkspaceModel;
  }

  return trimmed as SupportedWorkspaceModel;
}

export function normalizeWorkspaceModel(
  model: string | null | undefined
): SupportedWorkspaceModel {
  if (!model) return DEFAULT_WORKSPACE_GEMINI_MODEL;

  const normalized = canonicalWorkspaceModel(model);
  if ((SUPPORTED_WORKSPACE_MODELS as readonly string[]).includes(normalized)) {
    return normalized as SupportedWorkspaceModel;
  }

  if ((LEGACY_GEMINI_MODEL_ALIASES as readonly string[]).includes(model)) {
    return DEFAULT_WORKSPACE_GEMINI_MODEL;
  }

  if (
    model === DEFAULT_GEMINI_MODEL ||
    model === SMOKE_GEMINI_MODEL ||
    model === DEFAULT_QWEN_MODEL ||
    model === 'qwen-max' ||
    model === 'qwen3-coder-next'
  ) {
    return canonicalWorkspaceModel(
      model.startsWith('qwen')
        ? `qwen:${model}`
        : model.startsWith('gemini')
          ? `google:${model}`
          : DEFAULT_WORKSPACE_GEMINI_MODEL
    );
  }

  if (
    model.startsWith('gemini-') ||
    model.startsWith('gemma-') ||
    model.startsWith('gpt-') ||
    model.startsWith('o1') ||
    model.startsWith('o3') ||
    model.startsWith('claude-') ||
    model.startsWith('anthropic-') ||
    model.startsWith('qwen') ||
    model.startsWith('qwq-')
  ) {
    return canonicalWorkspaceModel(
      model.startsWith('claude-') || model.startsWith('anthropic-')
        ? `anthropic:${model.replace(/^anthropic-/, '')}`
        : model.startsWith('gpt-') || model.startsWith('o1') || model.startsWith('o3')
          ? `openai:${model}`
          : model.startsWith('qwen') || model.startsWith('qwq-')
            ? `qwen:${model}`
            : `google:${model}`
    );
  }

  return DEFAULT_WORKSPACE_GEMINI_MODEL;
}

export function workspaceModelLabel(model: string): string {
  const normalized = normalizeWorkspaceModel(model);
  switch (normalized) {
    case DEFAULT_WORKSPACE_GEMINI_MODEL:
      return 'Gemini 2.5 Flash';
    case SMOKE_WORKSPACE_GEMINI_MODEL:
      return 'Gemini 2.5 Flash-Lite';
    case 'google:gemini-2.5-pro':
      return 'Gemini 2.5 Pro (Precision Trace)';
    case DEFAULT_WORKSPACE_QWEN_MODEL:
      return 'Qwen Plus';
    case 'qwen:qwen-max':
      return 'Qwen Max';
    case 'qwen:qwen3-coder-next':
      return 'Qwen3 Coder Next';
    default:
      if (normalized.startsWith('openrouter:')) {
        return `OpenRouter · ${normalized.slice('openrouter:'.length)}`;
      }
      if (normalized.startsWith('openai:')) {
        return `OpenAI · ${normalized.slice('openai:'.length)}`;
      }
      if (normalized.startsWith('anthropic:')) {
        return `Anthropic · ${normalized.slice('anthropic:'.length)}`;
      }
      return `${normalized} (Legacy)`;
  }
}

export function workspaceModelDescription(model: string): string {
  const normalized = normalizeWorkspaceModel(model);
  switch (normalized) {
    case DEFAULT_WORKSPACE_GEMINI_MODEL:
      return 'Managed cloud model for general audit workloads.';
    case SMOKE_WORKSPACE_GEMINI_MODEL:
      return 'Low-cost Gemini variant for lightweight scans.';
    case 'google:gemini-2.5-pro':
      return 'Higher precision managed Gemini variant.';
    case DEFAULT_WORKSPACE_QWEN_MODEL:
      return 'Managed Qwen route for hybrid routing.';
    case 'qwen:qwen-max':
      return 'Higher capability Qwen route.';
    case 'qwen:qwen3-coder-next':
      return 'Code-centric Qwen route for technical traces.';
    default:
      if (normalized.startsWith('openrouter:')) {
        return 'OpenRouter-backed provider route.';
      }
      if (normalized.startsWith('openai:')) {
        return 'Managed OpenAI route.';
      }
      if (normalized.startsWith('anthropic:')) {
        return 'Managed Anthropic route.';
      }
      return 'Managed cloud route.';
  }
}
