import { scoreAuditMissionOutput } from './phoenix-code-evaluator';
import { scrubOutput } from '@premortem/security';

const DEFAULT_GEMINI_MODEL = 'gemini-3-flash-preview';

type PhoenixOtelModule = typeof import('@arizeai/phoenix-otel');

let phoenixOtelModulePromise: Promise<PhoenixOtelModule> | undefined;
let phoenixOtelLoadFailed = false;
let phoenixOtelLoadFailureLogged = false;
let provider: { shutdown: () => Promise<void> } | undefined;
let initialized = false;

function shouldLogPhoenixOtelFailure() {
  return process.env.PHOENIX_OTEL_DEBUG === '1';
}

function shouldLoadPhoenixOtel() {
  return process.env.PHOENIX_OTEL_ENABLED === '1';
}

function dynamicImportPhoenixOtel(): Promise<PhoenixOtelModule> {
  const loader = new Function('specifier', 'return import(specifier)') as (
    specifier: string
  ) => Promise<PhoenixOtelModule>;
  return loader('@arizeai/phoenix-otel');
}

async function loadPhoenixOtel() {
  if (!shouldLoadPhoenixOtel()) return null;
  if (phoenixOtelLoadFailed) return null;
  phoenixOtelModulePromise ??= dynamicImportPhoenixOtel();
  try {
    return await phoenixOtelModulePromise;
  } catch (error) {
    phoenixOtelLoadFailed = true;
    if (!phoenixOtelLoadFailureLogged && shouldLogPhoenixOtelFailure()) {
      phoenixOtelLoadFailureLogged = true;
      console.warn(
        'phoenix-tracing-disabled',
        error instanceof Error ? error.message : String(error)
      );
    }
    return null;
  }
}

export async function getLLMAttributes(...args: any[]): Promise<any> {
  const mod = await loadPhoenixOtel();
  if (!mod) return undefined;
  return (mod.getLLMAttributes as (...inner: any[]) => any)(...args);
}

export const trace: any = undefined;

async function traceAgent(...args: any[]): Promise<any> {
  const mod = await loadPhoenixOtel();
  if (!mod) return args[0];
  return (mod.traceAgent as (...inner: any[]) => any)(...args);
}

async function traceChain(...args: any[]): Promise<any> {
  const mod = await loadPhoenixOtel();
  if (!mod) return args[0];
  return (mod.traceChain as (...inner: any[]) => any)(...args);
}

async function traceTool(...args: any[]): Promise<any> {
  const mod = await loadPhoenixOtel();
  if (!mod) return args[0];
  return (mod.traceTool as (...inner: any[]) => any)(...args);
}

export async function withSpan(...args: any[]): Promise<any> {
  const mod = await loadPhoenixOtel();
  if (!mod) return args[0];
  return (mod.withSpan as (...inner: any[]) => any)(...args);
}

export function resolvePhoenixUrl() {
  const raw =
    process.env.PHOENIX_COLLECTOR_ENDPOINT?.trim() ||
    process.env.PHOENIX_BASE_URL?.trim() ||
    'http://localhost:6006';

  return raw.replace(/\/v1\/traces\/?$/, '').replace(/\/$/, '');
}

export function resolvePhoenixMcpBaseUrl() {
  const configured = process.env.PHOENIX_MCP_BASE_URL?.trim();
  if (configured) return configured.replace(/\/$/, '');

  const collector = process.env.PHOENIX_COLLECTOR_ENDPOINT?.trim();
  if (collector) {
    const withoutTraces = collector.replace(/\/v1\/traces\/?$/, '').replace(/\/$/, '');
    if (withoutTraces.includes('/s/')) return withoutTraces;
  }

  return 'https://app.phoenix.arize.com';
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
    process.env.PHOENIX_API_KEY?.trim() ||
      process.env.PHOENIX_COLLECTOR_ENDPOINT?.trim() ||
      process.env.PHOENIX_OTEL_ENABLED === '1'
  );
}

export function initPhoenixTracing(serviceName: string) {
  if (initialized || !shouldLoadPhoenixOtel()) return provider;
  if (!isPhoenixEnabled()) return undefined;

  void loadPhoenixOtel()
    .then((mod) => {
      if (!mod) return;
      const register = (mod as NonNullable<typeof mod>).register;
      provider = register({
        projectName: process.env.PHOENIX_PROJECT_NAME?.trim() || 'premortem',
        url: resolvePhoenixUrl(),
        apiKey: process.env.PHOENIX_API_KEY?.trim(),
        batch: process.env.NODE_ENV === 'production',
        headers: {
          'x-premortem-service': serviceName
        }
      }) as { shutdown: () => Promise<void> };
      initialized = true;
    })
    .catch((error) => {
      console.error('initPhoenixTracing.phoenix-load-failed', error);
    });

  return provider;
}

export async function shutdownPhoenixTracing() {
  if (!provider) return;
  await provider.shutdown();
  provider = undefined;
  initialized = false;
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
  if (!isPhoenixEnabled()) return fn();

  const mod = await loadPhoenixOtel();
  if (!mod) return fn();
  const traced = mod.withSpan(async () => fn(), {
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
  });

  return traced();
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

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${input.apiKey}`,
    {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        generationConfig: {
          temperature: 0,
          responseMimeType: 'application/json'
        },
        contents: [{ role: 'user', parts: [{ text: prompt }] }]
      })
    }
  );

  if (!response.ok) {
    throw new Error(`Gemini judge request failed: ${response.status} ${await response.text()}`);
  }

  const raw = (await response.json()) as {
    candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
  };
  const text =
    raw.candidates?.[0]?.content?.parts?.map((part) => part.text ?? '').join('\n') ?? '{}';

  const parsed = JSON.parse(text) as { label?: string; explanation?: string };
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
