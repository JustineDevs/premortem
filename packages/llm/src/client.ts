import { generateText, Output } from 'ai';
import { createOpenAI } from '@ai-sdk/openai';
import { DEFAULT_GEMINI_MODEL, DEFAULT_QWEN_MODEL } from '@premortem/domain';
import { tracePremortemLlmGenerate } from '@premortem/observability/phoenix';
import { scrubOutput } from '@premortem/security';
import { discoverLocalLlmProviders } from './local-llm-discovery';
import { premortemProviderRegistry } from './registry';
import { readQwenApiKey } from './qwen';
import type {
  LlmAdapter,
  LlmProviderTarget,
  LlmGenerateInput,
  LlmGenerateObjectInput,
  LlmGenerateObjectOutput,
  LlmGenerateOutput,
  LlmProvider,
  UnifiedLlmAdapterOptions
} from './types';
import {
  isLlmProviderTargetUsable,
  resolveLlmProviderTargets
} from './routing';

const DEFAULT_MODEL_BY_PROVIDER: Record<LlmProvider, string> = {
  google: DEFAULT_GEMINI_MODEL,
  openai: 'gpt-5.4',
  anthropic: 'claude-sonnet-4.6',
  qwen: DEFAULT_QWEN_MODEL,
  openrouter: 'google/gemini-2.5-flash'
};

type ProviderTarget = {
  provider: LlmProvider;
  model: string;
};

type SdkMessage = {
  role: 'system' | 'user' | 'assistant';
  content: string;
};

const DEFAULT_LLM_REQUEST_TIMEOUT_MS = 240_000;
const DEFAULT_CUSTOM_PROVIDER_MAX_OUTPUT_TOKENS = 8192;
const CUSTOM_PROVIDER_STRING_LIMIT = 400;
const CUSTOM_PROVIDER_ARRAY_LIMIT = 8;
const LOCAL_PROVIDER_DISCOVERY_TTL_MS = 30_000;
const DISABLED_CUSTOM_PROVIDER_TTL_MS = 60_000;
let discoveredLocalProvidersCache:
  | {
      fetchedAt: number;
      providers: Array<{
        name: string;
        host: string;
        model: string;
        active: true;
      }>;
    }
  | null = null;
const disabledCustomProviders = new Map<string, number>();
const customProviderExecutionQueues = new Map<string, Promise<void>>();

type PhoenixLlmSpanInput = {
  model: string;
  provider?: string;
  messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>;
  temperature?: number;
};

async function traceLlmGenerateIfEnabled<T>(
  input: PhoenixLlmSpanInput,
  fn: () => Promise<T>
): Promise<T> {
  if (
    process.env.PHOENIX_OTEL_ENABLED !== '1' &&
    !process.env.PHOENIX_API_KEY?.trim() &&
    !process.env.PHOENIX_COLLECTOR_ENDPOINT?.trim()
  ) {
    return fn();
  }

  return tracePremortemLlmGenerate(input, fn);
}

function normalizeProvider(value: string | undefined): LlmProvider | null {
  const normalized = value?.trim().toLowerCase();
  if (
    normalized === 'google' ||
    normalized === 'openai' ||
    normalized === 'anthropic' ||
    normalized === 'qwen' ||
    normalized === 'openrouter'
  ) {
    return normalized;
  }
  return null;
}

function normalizeCustomProviderKey(provider: {
  host?: string | null;
  name?: string | null;
  providerRef?: string | null;
  model?: string | null;
}) {
  const identifier =
    provider.name?.trim().toLowerCase() ??
    provider.providerRef?.trim().toLowerCase() ??
    provider.model?.trim().toLowerCase() ??
    '';
  return `${identifier}:${provider.host?.trim().replace(/\/$/, '') ?? ''}`;
}

function markCustomProviderTemporarilyUnavailable(target: LlmProviderTarget) {
  if (!target.baseUrl) return;
  disabledCustomProviders.set(normalizeCustomProviderKey(target), Date.now() + DISABLED_CUSTOM_PROVIDER_TTL_MS);
}

function isCustomProviderTemporarilyUnavailable(target: LlmProviderTarget) {
  if (!target.baseUrl) return false;

  const key = normalizeCustomProviderKey(target);
  const disabledUntil = disabledCustomProviders.get(key);
  if (!disabledUntil) {
    return false;
  }

  if (Date.now() > disabledUntil) {
    disabledCustomProviders.delete(key);
    return false;
  }

  return true;
}

function inferProviderFromModel(model: string): LlmProvider | null {
  const normalized = model.trim().toLowerCase();
  if (
    normalized.startsWith('gpt-') ||
    normalized.startsWith('o1') ||
    normalized.startsWith('o3') ||
    normalized.startsWith('openai-')
  ) {
    return 'openai';
  }

  if (normalized.startsWith('claude-') || normalized.startsWith('anthropic-')) {
    return 'anthropic';
  }

  if (
    normalized.startsWith('gemini-') ||
    normalized.startsWith('gemma-') ||
    normalized.startsWith('google-')
  ) {
    return 'google';
  }

  if (normalized.startsWith('qwen') || normalized.startsWith('qwq-')) {
    return 'qwen';
  }

  return null;
}

function readOpenRouterApiKey(env = process.env): string {
  return env.OPENROUTER_API_KEY?.trim() || env.OPEN_ROUTER_API_KEY?.trim() || '';
}

function resolveConfiguredProvider(env = process.env): LlmProvider {
  return (
    normalizeProvider(env.LLM_PROVIDER) ??
    (readOpenRouterApiKey(env) ? 'openrouter' : null) ??
    (env.OPENAI_API_KEY?.trim() ? 'openai' : null) ??
    (env.QWEN_API_KEY?.trim() || env.DASHSCOPE_API_KEY?.trim() ? 'qwen' : null) ??
    (env.ANTHROPIC_API_KEY?.trim() ? 'anthropic' : null) ??
    'google'
  );
}

export function hasConfiguredLlmProvider(env = process.env): boolean {
  return Boolean(
    normalizeProvider(env.LLM_PROVIDER) ||
      readOpenRouterApiKey(env) ||
      env.GEMINI_API_KEY?.trim() ||
      env.OPENAI_API_KEY?.trim() ||
      env.QWEN_API_KEY?.trim() ||
      env.DASHSCOPE_API_KEY?.trim() ||
      env.ANTHROPIC_API_KEY?.trim()
  );
}

function resolveModelTarget(inputModel: string, fallbackProvider: LlmProvider): ProviderTarget {
  const trimmed = inputModel.trim();
  const prefix = trimmed.match(/^(google|openai|anthropic|qwen|openrouter)(:|\/)(.+)$/);
  if (prefix) {
    if (prefix[1] === 'openrouter') {
      return {
        provider: 'openrouter',
        model: prefix[3].includes('/') ? prefix[3] : `openrouter/${prefix[3]}`
      };
    }

    if (fallbackProvider === 'openrouter') {
      return {
        provider: 'openrouter',
        model: trimmed
      };
    }

    return {
      provider: prefix[1] as LlmProvider,
      model: prefix[3]
    };
  }

  if (fallbackProvider === 'openrouter') {
    if (
      trimmed.startsWith('gemini-') ||
      trimmed.startsWith('gemma-') ||
      trimmed.startsWith('google-')
    ) {
      return { provider: 'openrouter', model: `google/${trimmed}` };
    }

    if (trimmed.startsWith('gpt-') || trimmed.startsWith('o1') || trimmed.startsWith('o3')) {
      return { provider: 'openrouter', model: `openai/${trimmed}` };
    }

    if (trimmed.startsWith('claude-')) {
      return { provider: 'openrouter', model: `anthropic/${trimmed}` };
    }

    if (trimmed.startsWith('qwen') || trimmed.startsWith('qwq-')) {
      return { provider: 'openrouter', model: `qwen/${trimmed}` };
    }
  }

  return {
    provider: inferProviderFromModel(trimmed) ?? fallbackProvider,
    model: trimmed || DEFAULT_MODEL_BY_PROVIDER[fallbackProvider]
  };
}

function resolveProviderModel(target: LlmProviderTarget, env = process.env) {
  if (target.baseUrl && target.provider === 'openai') {
    return createOpenAI({
      apiKey: env.OPENAI_API_KEY?.trim() || 'local',
      baseURL: normalizeCompatibleBaseUrl(target.baseUrl)
    }).chat(target.model);
  }

  if (target.baseUrl && target.provider === 'qwen') {
    return createOpenAI({
      apiKey: readQwenApiKey(env) || 'local',
      baseURL: normalizeCompatibleBaseUrl(target.baseUrl)
    }).chat(target.model);
  }

  const registryModelId = (
    target.provider === 'openrouter'
      ? `openrouter:${target.model}`
      : `${target.provider}:${target.model}`
  ) as Parameters<typeof premortemProviderRegistry.languageModel>[0];
  return premortemProviderRegistry.languageModel(registryModelId);
}

function resolveTargetProviderModel(target: LlmProviderTarget, env = process.env) {
  return resolveProviderModel(target, env);
}

export function normalizeCompatibleBaseUrl(baseUrl?: string | null): string {
  const normalized = baseUrl?.trim().replace(/\/$/, '');
  if (!normalized) return '';
  return normalized.endsWith('/v1') ? normalized : `${normalized}/v1`;
}

function splitSystemMessages(messages: LlmGenerateInput['messages']): {
  system?: string;
  messages: Array<Exclude<SdkMessage, { role: 'system' }>>;
} {
  const systemParts: string[] = [];
  const nonSystemMessages: Array<Exclude<SdkMessage, { role: 'system' }>> = [];

  for (const message of messages) {
    if (message.role === 'system') {
      systemParts.push(message.content);
      continue;
    }

    nonSystemMessages.push({
      role: message.role,
      content: message.content
    });
  }

  return {
    system: systemParts.length > 0 ? systemParts.join('\n\n') : undefined,
    messages: nonSystemMessages
  };
}

function formatObjectGenerationRepairPrompt(input: {
  schemaName: string;
  validationMessage: string;
  previousText: string;
}) {
  return [
    `The previous response failed validation for the ${input.schemaName} schema.`,
    'Return a corrected JSON object that matches the schema exactly.',
    input.validationMessage ? `Validation errors:\n${input.validationMessage}` : '',
    'Previous response:',
    input.previousText
  ]
    .filter(Boolean)
    .join('\n\n');
}

function extractJsonText(text: string): string {
  const trimmed = text.trim();
  const fenced = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  return (fenced?.[1] ?? trimmed).trim();
}

function parseStructuredOutputText<T>(schema: {
  parse(value: unknown): T;
}, text: string): T {
  const parsedText = extractJsonText(text);
  return schema.parse(JSON.parse(parsedText));
}

function compactJsonValue(value: unknown): unknown {
  if (typeof value === 'string') {
    if (value.length <= CUSTOM_PROVIDER_STRING_LIMIT) return value;
    return `${value.slice(0, CUSTOM_PROVIDER_STRING_LIMIT)}…[truncated ${value.length - CUSTOM_PROVIDER_STRING_LIMIT} chars]`;
  }

  if (Array.isArray(value)) {
    const limit = CUSTOM_PROVIDER_ARRAY_LIMIT;
    if (value.length <= limit) {
      return value.map((entry) => compactJsonValue(entry));
    }

    return [
      ...value.slice(0, limit).map((entry) => compactJsonValue(entry)),
      `…[truncated ${value.length - limit} items]`
    ];
  }

  if (!value || typeof value !== 'object') {
    return value;
  }

  const compacted: Record<string, unknown> = {};
  for (const [key, entry] of Object.entries(value as Record<string, unknown>)) {
    compacted[key] = compactJsonValue(entry);
  }
  return compacted;
}

function compactCustomProviderMessages(messages: SdkMessage[]): SdkMessage[] {
  return messages.map((message) => {
    if (message.role !== 'user') {
      return message;
    }

    const trimmed = message.content.trim();
    if (!trimmed.startsWith('{') && !trimmed.startsWith('[')) {
      return message;
    }

    try {
      const parsed = JSON.parse(trimmed) as unknown;
      const compactedText = JSON.stringify(compactJsonValue(parsed));
      if (compactedText.length > 0 && compactedText.length < trimmed.length) {
        return {
          ...message,
          content: compactedText
        };
      }
    } catch {
      return message;
    }

    return message;
  });
}

function prepareMessagesForProvider(
  target: LlmProviderTarget,
  messages: SdkMessage[]
): SdkMessage[] {
  return target.baseUrl ? compactCustomProviderMessages(messages) : messages;
}

function formatNoOutputRepairPrompt(schemaName: string) {
  return [
    `The previous response was empty for the ${schemaName} schema.`,
    'Return a complete JSON object that matches the schema exactly.',
    'Do not return an empty response, prose, markdown, or code fences.',
    'Return JSON only.'
  ].join('\n');
}

function resolveRequestTimeoutMs() {
  const configured = Number(process.env.LLM_REQUEST_TIMEOUT_MS);
  if (Number.isFinite(configured) && configured > 0) {
    return Math.floor(configured);
  }

  return DEFAULT_LLM_REQUEST_TIMEOUT_MS;
}

function resolveTargetMaxOutputTokens(
  target: LlmProviderTarget,
  requested?: number
): number | undefined {
  if (typeof requested === 'number' && Number.isFinite(requested) && requested > 0) {
    return Math.floor(requested);
  }

  return target.baseUrl ? DEFAULT_CUSTOM_PROVIDER_MAX_OUTPUT_TOKENS : undefined;
}

async function getDiscoveredLocalProviders() {
  if (
    discoveredLocalProvidersCache &&
    Date.now() - discoveredLocalProvidersCache.fetchedAt < LOCAL_PROVIDER_DISCOVERY_TTL_MS
  ) {
    return discoveredLocalProvidersCache.providers;
  }

  const providers = await discoverLocalLlmProviders();
  discoveredLocalProvidersCache = {
    fetchedAt: Date.now(),
    providers
  };
  return providers;
}

async function runQueuedForCustomProvider<T>(
  target: LlmProviderTarget,
  operation: () => Promise<T>
): Promise<T> {
  if (!target.baseUrl) {
    return operation();
  }

  const queueKey = `${target.provider}:${target.baseUrl}:${target.providerRef ?? target.model}`;
  const previousTail = customProviderExecutionQueues.get(queueKey) ?? Promise.resolve();
  const execution = previousTail.catch(() => undefined).then(operation);
  const nextTail = execution.then(
    () => undefined,
    () => undefined
  );

  customProviderExecutionQueues.set(queueKey, nextTail);

  return execution.finally(() => {
    if (customProviderExecutionQueues.get(queueKey) === nextTail) {
      customProviderExecutionQueues.delete(queueKey);
    }
  });
}

function createNoOutputError(label: string, target: ProviderTarget | LlmProviderTarget) {
  const error = new Error(`${label} returned no output for ${target.provider}/${target.model}`);
  error.name = 'AI_NoOutputGeneratedError';
  return error;
}

function formatProviderAttemptFailure(
  target: ProviderTarget | LlmProviderTarget,
  error: unknown
): string {
  const message = error instanceof Error ? error.message : String(error);
  return `${target.provider}/${target.model}: ${message}`;
}

function createProviderFallbackError(
  label: string,
  attempts: string[],
  lastError: unknown
): Error {
  const detail = attempts.length > 0 ? ` Attempts: ${attempts.join(' | ')}` : '';
  const message = `${label} failed for all configured providers.${detail}`;
  const error = new Error(message);
  error.name = 'LlmProviderFallbackError';
  if (lastError instanceof Error) {
    error.cause = lastError;
  }
  return error;
}

async function runWithTimeout<T>(
  timeoutMs: number,
  label: string,
  run: (abortSignal: AbortSignal) => Promise<T>
): Promise<T> {
  const controller = new AbortController();
  let timeoutHandle: ReturnType<typeof setTimeout> | undefined;

  const timeoutPromise = new Promise<T>((_resolve, reject) => {
    timeoutHandle = setTimeout(() => {
      controller.abort();
      reject(new Error(`${label} timed out after ${timeoutMs}ms`));
    }, timeoutMs);
  });

  try {
    return await Promise.race([run(controller.signal), timeoutPromise]);
  } finally {
    if (timeoutHandle) {
      clearTimeout(timeoutHandle);
    }
  }
}

export class UnifiedLlmAdapter implements LlmAdapter {
  constructor(
    private readonly defaultProvider: LlmProvider = resolveConfiguredProvider(),
    private readonly options: UnifiedLlmAdapterOptions = {}
  ) {}

  get provider(): LlmProvider {
    return this.defaultProvider;
  }

  private resolveModel(inputModel: string): ProviderTarget {
    return resolveModelTarget(inputModel, this.defaultProvider);
  }

  private async resolveCandidates(inputModel: string): Promise<LlmProviderTarget[]> {
    const discoveredLocalProviders = await getDiscoveredLocalProviders();
    const mergedCustomProviders = [...(this.options.customProviders ?? [])];

    for (const discovered of discoveredLocalProviders) {
      const existingIndex = mergedCustomProviders.findIndex(
        (provider) => provider.name === discovered.name || provider.host === discovered.host
      );
      if (existingIndex >= 0) {
        mergedCustomProviders[existingIndex] = {
          ...mergedCustomProviders[existingIndex]!,
          host: discovered.host,
          model: discovered.model,
          active: true
        };
      } else {
        mergedCustomProviders.push(discovered);
      }
    }

    const activeCustomProviders = mergedCustomProviders.filter(
      (provider) =>
        !isCustomProviderTemporarilyUnavailable({
          provider: 'openai',
          model: provider.model,
          baseUrl: provider.host,
          providerRef: provider.name,
          kind: 'custom',
          label: provider.name
        })
    );

    const routingTargets = resolveLlmProviderTargets({
      model: inputModel,
      defaultProvider: this.defaultProvider,
      vendorRouting: this.options.vendorRouting,
      customProviders: activeCustomProviders
    });
    const usableRoutingTargets = routingTargets.filter((target) => isLlmProviderTargetUsable(target));
    if (usableRoutingTargets.length > 0) {
      return usableRoutingTargets;
    }

    if (!hasConfiguredLlmProvider()) {
      throw new Error(
        'No usable LLM provider is configured. Enable a local provider or set a cloud API key before generating.'
      );
    }

    const target = this.resolveModel(inputModel);
    return [
      {
        provider: target.provider,
        model: target.model,
        kind: 'fallback',
        label: `${target.provider}/${target.model}`
      }
    ];
  }

  private async runGenerate(input: LlmGenerateInput) {
    const targets = await this.resolveCandidates(input.model);
    const { system, messages } = splitSystemMessages(input.messages);
    const timeoutMs = resolveRequestTimeoutMs();
    let lastError: unknown = null;
    const attempts: string[] = [];

    for (const target of targets) {
      try {
        const providerModel = resolveTargetProviderModel(target);
        const providerMessages = prepareMessagesForProvider(target, messages);
        const maxOutputTokens = resolveTargetMaxOutputTokens(target, input.maxOutputTokens);
        const result = target.baseUrl
          ? await runQueuedForCustomProvider(target, () =>
              runWithTimeout(
                timeoutMs,
                `LLM text generation for ${target.provider}/${target.model}`,
                (abortSignal) =>
                  traceLlmGenerateIfEnabled(
                    {
                      model: target.model,
                      provider: target.provider,
                      messages: providerMessages,
                      temperature: input.temperature
                    },
                    async () =>
                      generateText({
                        model: providerModel,
                        temperature: input.temperature ?? 0.2,
                        maxOutputTokens,
                        system,
                        messages: providerMessages,
                        abortSignal,
                        timeout: timeoutMs
                      })
                  )
              )
            )
          : await runWithTimeout(
              timeoutMs,
              `LLM text generation for ${target.provider}/${target.model}`,
              (abortSignal) =>
                traceLlmGenerateIfEnabled(
                  {
                    model: target.model,
                    provider: target.provider,
                    messages: providerMessages,
                    temperature: input.temperature
                  },
                  async () =>
                    generateText({
                      model: providerModel,
                      temperature: input.temperature ?? 0.2,
                      maxOutputTokens: input.maxOutputTokens,
                      system,
                      messages: providerMessages,
                      abortSignal,
                      timeout: timeoutMs
                    })
                )
            );
        if (!result.text?.trim()) {
          throw createNoOutputError('LLM text generation', target);
        }
        return result;
      } catch (error) {
        lastError = error;
        attempts.push(formatProviderAttemptFailure(target, error));
        if (target.baseUrl) {
          markCustomProviderTemporarilyUnavailable(target);
        }
      }
    }

    throw createProviderFallbackError('LLM text generation', attempts, lastError);
  }

  async generate(input: LlmGenerateInput): Promise<LlmGenerateOutput> {
    const result = await this.runGenerate(input);
    return {
      text: scrubOutput(result.text ?? ''),
      raw: result
    };
  }

  async generateObject<T>(input: LlmGenerateObjectInput<T>): Promise<LlmGenerateObjectOutput<T>> {
    const targets = await this.resolveCandidates(input.model);
    const { system, messages } = splitSystemMessages(input.messages);
    const timeoutMs = resolveRequestTimeoutMs();
    const schemaName = 'structured output';
    let lastError: unknown = null;
    const attempts: string[] = [];

    for (const target of targets) {
      const providerModel = resolveTargetProviderModel(target);
      const isCustomTarget = Boolean(target.baseUrl);
      const providerMessages = prepareMessagesForProvider(target, messages);
      const maxOutputTokens = resolveTargetMaxOutputTokens(target, input.maxOutputTokens);

      const runObjectGeneration = async (repairPrompt?: string) =>
        target.baseUrl
          ? await runQueuedForCustomProvider(target, () =>
              runWithTimeout(
                timeoutMs,
                `LLM object generation for ${target.provider}/${target.model}`,
                (abortSignal) =>
                  traceLlmGenerateIfEnabled(
                    {
                      model: target.model,
                      provider: target.provider,
                      messages: repairPrompt
                        ? [...providerMessages, { role: 'user' as const, content: repairPrompt }]
                        : providerMessages,
                      temperature: input.temperature
                    },
                    async () =>
                      generateText({
                        model: providerModel,
                        temperature: repairPrompt ? 0 : input.temperature ?? 0.2,
                        maxOutputTokens,
                        system:
                          repairPrompt && system
                            ? `${system}\n\n${repairPrompt}`
                            : repairPrompt
                              ? repairPrompt
                              : system,
                        messages: repairPrompt
                          ? compactCustomProviderMessages([
                              ...providerMessages,
                              { role: 'user' as const, content: repairPrompt }
                            ])
                          : providerMessages,
                        abortSignal,
                        timeout: timeoutMs
                      })
                  )
              )
            )
          : runWithTimeout(
              timeoutMs,
              `LLM object generation for ${target.provider}/${target.model}`,
              (abortSignal) =>
                traceLlmGenerateIfEnabled(
                  {
                    model: target.model,
                    provider: target.provider,
                    messages: repairPrompt
                      ? [...providerMessages, { role: 'user' as const, content: repairPrompt }]
                      : providerMessages,
                    temperature: input.temperature
                  },
                  async () =>
                    generateText({
                      model: providerModel,
                      temperature: repairPrompt ? 0 : input.temperature ?? 0.2,
                      maxOutputTokens: input.maxOutputTokens,
                      system:
                        repairPrompt && system
                          ? `${system}\n\n${repairPrompt}`
                          : repairPrompt
                            ? repairPrompt
                            : system,
                      messages: repairPrompt
                        ? compactCustomProviderMessages([
                            ...providerMessages,
                            { role: 'user' as const, content: repairPrompt }
                          ])
                        : providerMessages,
                      abortSignal,
                      timeout: timeoutMs,
                      ...(isCustomTarget
                        ? {}
                        : {
                            output: Output.object({
                              schema: input.schema
                            })
                          })
                    })
                )
            );

      try {
        let result;
        if (isCustomTarget) {
          const runTextGeneration = async (repairPrompt?: string) =>
            runQueuedForCustomProvider(target, () =>
              runWithTimeout(
                timeoutMs,
                `LLM object generation for ${target.provider}/${target.model}`,
                (abortSignal) =>
                  traceLlmGenerateIfEnabled(
                    {
                      model: target.model,
                      provider: target.provider,
                      messages: repairPrompt
                        ? [...providerMessages, { role: 'user' as const, content: repairPrompt }]
                        : providerMessages,
                      temperature: input.temperature
                    },
                    async () =>
                      generateText({
                        model: providerModel,
                        temperature: repairPrompt ? 0 : input.temperature ?? 0.2,
                        maxOutputTokens,
                        system:
                          repairPrompt && system
                            ? `${system}\n\n${repairPrompt}`
                            : repairPrompt
                              ? repairPrompt
                              : system,
                        messages: repairPrompt
                          ? compactCustomProviderMessages([
                              ...providerMessages,
                              { role: 'user' as const, content: repairPrompt }
                            ])
                          : providerMessages,
                        abortSignal,
                        timeout: timeoutMs
                      })
                  )
              )
            );

          try {
            result = await runTextGeneration();
            try {
              const output = parseStructuredOutputText(input.schema, result.text);
              return {
                output,
                raw: result
              };
            } catch (parseError) {
              const previousText = result.text ?? '';
              const validationMessage =
                parseError instanceof Error ? parseError.message : String(parseError);
              const repairPrompt = formatObjectGenerationRepairPrompt({
                schemaName,
                validationMessage,
                previousText: previousText || formatNoOutputRepairPrompt(schemaName)
              });
              result = await runTextGeneration(repairPrompt);
              const output = parseStructuredOutputText(input.schema, result.text);
              return {
                output,
                raw: result
              };
            }
          } catch (error) {
            const previousText = error instanceof Error ? (error as { text?: string }).text ?? '' : '';
            const validationMessage =
              error instanceof Error && 'cause' in error && error.cause instanceof Error
                ? error.cause.message
                : error instanceof Error
                  ? error.message
                  : String(error);
            const isNoOutput =
              error instanceof Error &&
              (error.name === 'AI_NoOutputGeneratedError' ||
                error.name === 'AI_NoObjectGeneratedError' ||
                /no output generated/i.test(error.message) ||
                /did not match schema/i.test(error.message) ||
                /no object generated/i.test(error.message) ||
                /Unexpected token/i.test(error.message));
            if (!previousText && !isNoOutput) {
              throw error;
            }

            const repairPrompt = formatObjectGenerationRepairPrompt({
              schemaName,
              validationMessage,
              previousText: previousText || formatNoOutputRepairPrompt(schemaName)
            });
            result = await runTextGeneration(repairPrompt);
            const output = parseStructuredOutputText(input.schema, result.text);
            return {
              output,
              raw: result
            };
          }
        }

        try {
          result = await runObjectGeneration();
        } catch (error) {
          const previousText = error instanceof Error ? (error as { text?: string }).text ?? '' : '';
          const validationMessage =
            error instanceof Error && 'cause' in error && error.cause instanceof Error
              ? error.cause.message
              : error instanceof Error
                ? error.message
                : String(error);
          const isNoOutput =
            error instanceof Error &&
            (error.name === 'AI_NoOutputGeneratedError' ||
              error.name === 'AI_NoObjectGeneratedError' ||
              /no output generated/i.test(error.message) ||
              /did not match schema/i.test(error.message) ||
              /no object generated/i.test(error.message));
          if (!previousText && !isNoOutput) {
            throw error;
          }

          const repairPrompt = formatObjectGenerationRepairPrompt({
            schemaName,
            validationMessage,
            previousText: previousText || formatNoOutputRepairPrompt(schemaName)
          });

          result = await runObjectGeneration(repairPrompt);
        }

        if (!result.output || typeof result.output !== 'object') {
          throw createNoOutputError('LLM object generation', target);
        }

        return {
          output: result.output as T,
          raw: result
        };
      } catch (error) {
        lastError = error;
        attempts.push(formatProviderAttemptFailure(target, error));
        if (target.baseUrl) {
          markCustomProviderTemporarilyUnavailable(target);
        }
      }
    }

    throw createProviderFallbackError('LLM object generation', attempts, lastError);
  }
}
