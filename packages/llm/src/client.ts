import { generateText, Output } from 'ai';
import { createAnthropic } from '@ai-sdk/anthropic';
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { createOpenAI } from '@ai-sdk/openai';
import { DEFAULT_GEMINI_MODEL } from '@premortem/domain';
import { tracePremortemLlmGenerate } from '@premortem/observability/phoenix';
import { scrubOutput } from '@premortem/security';
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
  qwen: 'qwen-plus'
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
    normalized === 'qwen'
  ) {
    return normalized;
  }
  return null;
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

function resolveConfiguredProvider(env = process.env): LlmProvider {
  return (
    normalizeProvider(env.LLM_PROVIDER) ??
    (env.OPENAI_API_KEY?.trim() ? 'openai' : null) ??
    (env.QWEN_API_KEY?.trim() || env.DASHSCOPE_API_KEY?.trim() ? 'qwen' : null) ??
    (env.ANTHROPIC_API_KEY?.trim() ? 'anthropic' : null) ??
    'google'
  );
}

function resolveModelTarget(inputModel: string, fallbackProvider: LlmProvider): ProviderTarget {
  const trimmed = inputModel.trim();
  const prefix = trimmed.match(/^(google|openai|anthropic|qwen)\/(.+)$/);
  if (prefix) {
    return {
      provider: prefix[1] as LlmProvider,
      model: prefix[2]
    };
  }

  return {
    provider: inferProviderFromModel(trimmed) ?? fallbackProvider,
    model: trimmed || DEFAULT_MODEL_BY_PROVIDER[fallbackProvider]
  };
}

function resolveProviderModel(provider: LlmProvider, env = process.env) {
  switch (provider) {
    case 'google': {
      const apiKey = env.GEMINI_API_KEY?.trim();
      if (!apiKey) {
        throw new Error('GEMINI_API_KEY is required for the Google model provider.');
      }
      return createGoogleGenerativeAI({ apiKey });
    }
    case 'openai': {
      const apiKey = env.OPENAI_API_KEY?.trim();
      if (!apiKey) {
        throw new Error('OPENAI_API_KEY is required for the OpenAI model provider.');
      }
      return createOpenAI({ apiKey });
    }
    case 'anthropic': {
      const apiKey = env.ANTHROPIC_API_KEY?.trim();
      if (!apiKey) {
        throw new Error('ANTHROPIC_API_KEY is required for the Anthropic model provider.');
      }
      return createAnthropic({ apiKey });
    }
    case 'qwen': {
      const apiKey = env.QWEN_API_KEY?.trim() || env.DASHSCOPE_API_KEY?.trim();
      if (!apiKey) {
        throw new Error(
          'QWEN_API_KEY or DASHSCOPE_API_KEY is required for the Qwen model provider.'
        );
      }

      const baseURL =
        env.QWEN_BASE_URL?.trim() ||
        env.DASHSCOPE_BASE_URL?.trim() ||
        'https://dashscope.aliyuncs.com/compatible-mode/v1';

      return createOpenAI({ apiKey, baseURL });
    }
  }
}

function resolveTargetProviderModel(target: LlmProviderTarget, env = process.env) {
  if (target.provider === 'openai' && target.baseUrl) {
    return createOpenAI({
      apiKey: env.OPENAI_API_KEY?.trim() || 'local',
      baseURL: target.baseUrl
    });
  }

  if (target.provider === 'qwen' && target.baseUrl) {
    return createOpenAI({
      apiKey: env.QWEN_API_KEY?.trim() || env.DASHSCOPE_API_KEY?.trim() || 'local',
      baseURL: target.baseUrl
    });
  }

  return resolveProviderModel(target.provider, env);
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

  private resolveCandidates(inputModel: string): LlmProviderTarget[] {
    const routingTargets = resolveLlmProviderTargets({
      model: inputModel,
      defaultProvider: this.defaultProvider,
      vendorRouting: this.options.vendorRouting,
      customProviders: this.options.customProviders
    });
    const usableRoutingTargets = routingTargets.filter((target) => isLlmProviderTargetUsable(target));
    if (usableRoutingTargets.length > 0) {
      return usableRoutingTargets;
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
    const targets = this.resolveCandidates(input.model);
    const { system, messages } = splitSystemMessages(input.messages);
    const timeoutMs = resolveRequestTimeoutMs();
    let lastError: unknown = null;

    for (const target of targets) {
      try {
        const providerModel = resolveTargetProviderModel(target);
        return await runWithTimeout(
          timeoutMs,
          `LLM text generation for ${target.provider}/${target.model}`,
          (abortSignal) =>
            traceLlmGenerateIfEnabled(
              {
                model: target.model,
                provider: target.provider,
                messages: input.messages,
                temperature: input.temperature
              },
              async () =>
                generateText({
                  model: providerModel(target.model),
                  temperature: input.temperature ?? 0.2,
                  maxOutputTokens: input.maxOutputTokens,
                  system,
                  messages,
                  abortSignal,
                  timeout: timeoutMs
                })
            )
        );
      } catch (error) {
        lastError = error;
      }
    }

    throw lastError instanceof Error ? lastError : new Error('No usable LLM provider could generate output.');
  }

  async generate(input: LlmGenerateInput): Promise<LlmGenerateOutput> {
    const result = await this.runGenerate(input);
    return {
      text: scrubOutput(result.text ?? ''),
      raw: result
    };
  }

  async generateObject<T>(input: LlmGenerateObjectInput<T>): Promise<LlmGenerateObjectOutput<T>> {
    const targets = this.resolveCandidates(input.model);
    const { system, messages } = splitSystemMessages(input.messages);
    const timeoutMs = resolveRequestTimeoutMs();
    const schemaName = 'structured output';
    let lastError: unknown = null;

    for (const target of targets) {
      const providerModel = resolveTargetProviderModel(target);

      const runObjectGeneration = async (repairPrompt?: string) =>
        runWithTimeout(
          timeoutMs,
          `LLM object generation for ${target.provider}/${target.model}`,
          (abortSignal) =>
            traceLlmGenerateIfEnabled(
              {
                model: target.model,
                provider: target.provider,
                messages: repairPrompt
                  ? [...input.messages, { role: 'user' as const, content: repairPrompt }]
                  : input.messages,
                temperature: input.temperature
              },
              async () =>
                generateText({
                  model: providerModel(target.model),
                  temperature: repairPrompt ? 0 : input.temperature ?? 0.2,
                  maxOutputTokens: input.maxOutputTokens,
                  system:
                    repairPrompt && system
                      ? `${system}\n\n${repairPrompt}`
                      : repairPrompt
                        ? repairPrompt
                        : system,
                  messages: repairPrompt
                    ? [...messages, { role: 'user' as const, content: repairPrompt }]
                    : messages,
                  abortSignal,
                  timeout: timeoutMs,
                  output: Output.object({
                    schema: input.schema
                  })
                })
            )
        );

      try {
        let result;
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
            (error.name === 'AI_NoOutputGeneratedError' || /no output generated/i.test(error.message));
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

        return {
          output: result.output as T,
          raw: result
        };
      } catch (error) {
        lastError = error;
      }
    }

    throw lastError instanceof Error ? lastError : new Error('No usable LLM provider could generate structured output.');
  }
}
