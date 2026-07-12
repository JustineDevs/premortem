import { generateText } from 'ai';
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { trace as phoenixTrace } from '@arizeai/phoenix-otel';
import { scoreAuditMissionOutput } from './phoenix-code-evaluator';
import { scrubOutput } from '@premortem/security';

const DEFAULT_GEMINI_MODEL = 'gemini-2.5-flash';

type PhoenixOtelModule = typeof import('@arizeai/phoenix-otel');

let phoenixOtelModulePromise: Promise<PhoenixOtelModule> | undefined;
let phoenixOtelLoadFailureLogged = false;
let provider: { shutdown: () => Promise<void> } | undefined;
let initialized = false;
let initPromise: Promise<{ shutdown: () => Promise<void> } | undefined> | undefined;

function shouldLogPhoenixOtelFailure() {
  return process.env.PHOENIX_OTEL_DEBUG === '1';
}

function shouldLoadPhoenixOtel() {
  return isPhoenixEnabled();
}

function dynamicImportPhoenixOtel(): Promise<PhoenixOtelModule> {
  const loader = new Function('specifier', 'return import(specifier)') as (
    specifier: string
  ) => Promise<PhoenixOtelModule>;
  return loader('@arizeai/phoenix-otel');
}

async function loadPhoenixOtel() {
  if (!shouldLoadPhoenixOtel()) {
    throw new Error(
      'Phoenix OTEL is required. Set PHOENIX_OTEL_ENABLED=1 and install @arizeai/phoenix-otel.'
    );
  }
  phoenixOtelModulePromise ??= dynamicImportPhoenixOtel();
  try {
    return await phoenixOtelModulePromise;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (!phoenixOtelLoadFailureLogged && shouldLogPhoenixOtelFailure()) {
      phoenixOtelLoadFailureLogged = true;
      console.error('phoenix-tracing-load-failed', message);
    }
    throw new Error(`Phoenix OTEL unavailable: ${message}`);
  }
}

export async function getLLMAttributes(...args: any[]): Promise<any> {
  const mod = await loadPhoenixOtel();
  return (mod.getLLMAttributes as (...inner: any[]) => any)(...args);
}

export interface PhoenixTraceLike {
  getActiveSpan(): { setAttribute(name: string, value: string): void } | null;
}

export const trace: PhoenixTraceLike = phoenixTrace as PhoenixTraceLike;

async function traceAgent(...args: any[]): Promise<any> {
  const mod = await loadPhoenixOtel();
  return (mod.traceAgent as (...inner: any[]) => any)(...args);
}

async function traceChain(...args: any[]): Promise<any> {
  const mod = await loadPhoenixOtel();
  return (mod.traceChain as (...inner: any[]) => any)(...args);
}

async function traceTool(...args: any[]): Promise<any> {
  const mod = await loadPhoenixOtel();
  return (mod.traceTool as (...inner: any[]) => any)(...args);
}

export async function withSpan(...args: any[]): Promise<any> {
  const mod = await loadPhoenixOtel();
  return (mod.withSpan as (...inner: any[]) => any)(...args);
}

export function resolvePhoenixUrl() {
  const raw = process.env.PHOENIX_COLLECTOR_ENDPOINT?.trim() || process.env.PHOENIX_BASE_URL?.trim();
  if (!raw) {
    throw new Error(
      'Phoenix is required. Set PHOENIX_COLLECTOR_ENDPOINT or PHOENIX_BASE_URL before startup.'
    );
  }

  return raw.replace(/\/v1\/traces\/?$/, '').replace(/\/$/, '');
}

export function resolvePhoenixMcpBaseUrl() {
  const configured = process.env.PHOENIX_MCP_BASE_URL?.trim();
  if (configured) return configured.replace(/\/$/, '');

  const baseUrl = process.env.PHOENIX_BASE_URL?.trim();
  if (baseUrl) return baseUrl.replace(/\/v1\/traces\/?$/, '').replace(/\/$/, '');

  const collector = process.env.PHOENIX_COLLECTOR_ENDPOINT?.trim();
  if (collector) {
    const withoutTraces = collector.replace(/\/v1\/traces\/?$/, '').replace(/\/$/, '');
    if (withoutTraces.includes('/s/')) return withoutTraces;
    return withoutTraces;
  }

  throw new Error(
    'Phoenix MCP is required. Set PHOENIX_MCP_BASE_URL or PHOENIX_COLLECTOR_ENDPOINT before probing.'
  );
}

export interface PhoenixEndpointProbe {
  ok: boolean;
  baseUrl: string;
  status: number;
  serverVersion: string | null;
  contentType: string | null;
  bodyPreview?: string;
  error?: string;
}

export async function probePhoenixEndpoint(): Promise<PhoenixEndpointProbe> {
  const baseUrl = resolvePhoenixMcpBaseUrl();
  const apiKey = process.env.PHOENIX_API_KEY?.trim();

  try {
    const response = await fetch(baseUrl, {
      headers: {
        ...(apiKey ? { 'x-api-key': apiKey, Authorization: `Bearer ${apiKey}` } : {})
      }
    });

    const bodyPreview = (await response.text()).slice(0, 200);

    return {
      ok: response.ok,
      baseUrl,
      status: response.status,
      serverVersion: response.headers.get('x-phoenix-server-version'),
      contentType: response.headers.get('content-type'),
      bodyPreview
    };
  } catch (error) {
    return {
      ok: false,
      baseUrl,
      status: 0,
      serverVersion: null,
      contentType: null,
      error: error instanceof Error ? error.message : String(error)
    };
  }
}

export function isPhoenixEnabled() {
  return Boolean(
    process.env.PHOENIX_API_KEY?.trim() &&
      (process.env.PHOENIX_COLLECTOR_ENDPOINT?.trim() || process.env.PHOENIX_BASE_URL?.trim())
  );
}

export async function initPhoenixTracing(serviceName: string) {
  if (initialized) return provider;
  if (initPromise) return initPromise;

  const apiKey = process.env.PHOENIX_API_KEY?.trim();
  if (!apiKey) {
    throw new Error('Phoenix is required. Set PHOENIX_API_KEY before startup.');
  }

  const url = resolvePhoenixUrl();

  initPromise = (async () => {
    const mod = await loadPhoenixOtel();
    const register = (mod as NonNullable<typeof mod>).register;
    provider = register({
      projectName: process.env.PHOENIX_PROJECT_NAME?.trim() || 'premortem',
      url,
      apiKey,
      batch: process.env.NODE_ENV === 'production',
      headers: {
        'x-premortem-service': serviceName
      }
    }) as { shutdown: () => Promise<void> };
    initialized = true;
    return provider;
  })();

  try {
    return await initPromise;
  } finally {
    initPromise = undefined;
  }
}

export async function shutdownPhoenixTracing() {
  if (!provider) return;
  await provider.shutdown();
  provider = undefined;
  initialized = false;
}

export async function probePhoenixTracing(serviceName = 'premortem-observability-smoke') {
  const started = await initPhoenixTracing(serviceName);
  if (!started) {
    throw new Error('Phoenix tracing did not initialize.');
  }
  await shutdownPhoenixTracing();
}

export const tracePremortemAgentMission = traceAgent;
export const tracePremortemAuditJob = traceChain;
export const tracePremortemToolCall = traceTool;

export interface PhoenixLlmSpanInput {
  model: string;
  provider?: string;
  spanName?: string;
  messages: Array<{ role: string; content: string }>;
  temperature?: number;
}

function resolveLlmSpanName(input: PhoenixLlmSpanInput) {
  const explicit = input.spanName?.trim();
  if (explicit) return explicit;

  const provider = input.provider?.trim() || 'google';
  const model = input.model.trim().replace(/[^a-zA-Z0-9._-]+/g, '-');
  return `premortem.llm.generate.${provider}.${model}`;
}

export async function tracePremortemLlmGenerate<T>(
  input: PhoenixLlmSpanInput,
  fn: () => Promise<T>
): Promise<T> {
  const mod = await loadPhoenixOtel();
  const tracedFn = mod.withSpan(() => fn(), {
    name: resolveLlmSpanName(input),
    kind: 'LLM',
    processInput: () =>
      mod.getLLMAttributes({
        provider: input.provider ?? 'google',
        modelName: input.model,
        inputMessages: input.messages.map((message) => ({
          role: message.role,
          content: message.content
        })),
        invocationParameters: {
          temperature: input.temperature
        }
      }),
    processOutput: (result: T) => {
      const text =
        result && typeof result === 'object' && 'text' in result
          ? scrubOutput(String((result as { text?: unknown }).text ?? ''))
          : scrubOutput(JSON.stringify(result));
      return mod.getLLMAttributes({
        provider: input.provider ?? 'google',
        modelName: input.model,
        outputMessages: [{ role: 'assistant', content: text.slice(0, 4000) }]
      });
    }
  }) as () => Promise<T>;

  return await tracedFn();
}

export interface AuditFindingEvalInput {
  auditRunId: string;
  findingCount: number;
  issueCandidateCount: number;
  hasHumanReviewGate: boolean;
  findingConfidenceAvg?: number;
  evidenceCountMin?: number;
  refusalRate?: number;
}

export function evaluateAuditMissionQuality(input: AuditFindingEvalInput) {
  const scored = scoreAuditMissionOutput(
    {
      findingCount: input.findingCount,
      issueCandidateCount: input.issueCandidateCount,
      hasHumanReviewGate: input.hasHumanReviewGate,
      findingConfidenceAvg: input.findingConfidenceAvg,
      evidenceCountMin: input.evidenceCountMin,
      refusalRate: input.refusalRate
    },
    { minFindingCount: 1, minScore: 0.66 }
  );

  return {
    evaluator: 'premortem-code-eval',
    auditRunId: input.auditRunId,
    score: scored.score,
    passed: scored.passed,
    label: scored.label,
    explanation: scored.explanation,
    checks: scored.checks
  };
}

export interface AuditMissionLlmJudgeInput {
  auditRunId: string;
  findingCount: number;
  issueCandidateCount: number;
  sampleFindingTitles?: string[];
  apiKey: string;
  model?: string;
}

export interface AuditMissionLlmJudgeResult {
  evaluator: 'premortem-llm-judge';
  auditRunId: string;
  label: 'acceptable' | 'needs_improvement';
  score: number;
  passed: boolean;
  explanation: string;
}

function resolveGeminiJudgeModel(model?: string) {
  return model?.trim() || process.env.LLM_MODEL?.trim() || DEFAULT_GEMINI_MODEL;
}

function parseJsonObjectFromLlmText<T extends Record<string, unknown>>(text: string): T {
  const attempts = [text.trim()];
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  if (fenced?.[1]) {
    attempts.unshift(fenced[1].trim());
  }

  for (const candidate of attempts) {
    if (!candidate) continue;
    try {
      return JSON.parse(candidate) as T;
    } catch {
      // keep trying
    }
  }

  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start >= 0 && end > start) {
    try {
      return JSON.parse(text.slice(start, end + 1)) as T;
    } catch {
      // fall through
    }
  }

  return {} as T;
}

export async function evaluateAuditMissionWithLlmJudge(
  input: AuditMissionLlmJudgeInput
): Promise<AuditMissionLlmJudgeResult> {
  const model = resolveGeminiJudgeModel(input.model);
  const titles = (input.sampleFindingTitles ?? []).slice(0, 8);
  const prompt = [
    'You are an evaluation judge for Premortem predictive code audits.',
    'Score whether the audit mission output is acceptable for human review.',
    'Return JSON only: {"label":"acceptable"|"needs_improvement","explanation":"..."}',
    `Audit run: ${input.auditRunId}`,
    `Finding count: ${input.findingCount}`,
    `Issue candidate count: ${input.issueCandidateCount}`,
    titles.length > 0 ? `Sample findings: ${titles.join('; ')}` : 'Sample findings: none'
  ].join('\n');

  const google = createGoogleGenerativeAI({ apiKey: input.apiKey });
  const result = await generateText({
    model: google(model),
    temperature: 0,
    messages: [{ role: 'user', content: prompt }]
  });
  const text = result.text || '{}';

  const parsed = parseJsonObjectFromLlmText<{ label?: string; explanation?: string }>(text);
  const label = parsed.label === 'acceptable' ? 'acceptable' : 'needs_improvement';
  const explanation = parsed.explanation?.trim() || 'No explanation returned.';
  const score = label === 'acceptable' ? 1 : 0;

  return {
    evaluator: 'premortem-llm-judge',
    auditRunId: input.auditRunId,
    label,
    score,
    passed: label === 'acceptable',
    explanation
  };
}
