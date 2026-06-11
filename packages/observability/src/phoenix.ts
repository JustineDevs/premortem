import {
  getLLMAttributes,
  register,
  traceAgent,
  traceChain,
  traceTool,
  withSpan
} from '@arizeai/phoenix-otel';

export {
  getLLMAttributes,
  traceAgent,
  traceChain,
  traceTool,
  withSpan
};

let provider: ReturnType<typeof register> | undefined;
let initialized = false;

function resolvePhoenixUrl() {
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

export function isPhoenixEnabled() {
  return Boolean(
    process.env.PHOENIX_API_KEY?.trim() ||
      process.env.PHOENIX_COLLECTOR_ENDPOINT?.trim() ||
      process.env.PHOENIX_OTEL_ENABLED === '1'
  );
}

export function initPhoenixTracing(serviceName: string) {
  if (initialized || process.env.PHOENIX_OTEL_ENABLED === '0') return provider;

  if (!isPhoenixEnabled()) return undefined;

  provider = register({
    projectName: process.env.PHOENIX_PROJECT_NAME?.trim() || 'premortem',
    url: resolvePhoenixUrl(),
    apiKey: process.env.PHOENIX_API_KEY?.trim(),
    batch: process.env.NODE_ENV === 'production',
    headers: {
      'x-premortem-service': serviceName
    }
  });

  initialized = true;
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
  messages: Array<{ role: string; content: string }>;
  temperature?: number;
}

export async function tracePremortemLlmGenerate<T>(
  input: PhoenixLlmSpanInput,
  fn: () => Promise<T>
): Promise<T> {
  if (!isPhoenixEnabled()) return fn();

  const traced = withSpan(async () => fn(), {
    name: 'gemini.generateContent',
    kind: 'LLM',
    processInput: () =>
      getLLMAttributes({
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
          ? String((result as { text?: unknown }).text ?? '')
          : JSON.stringify(result);
      return getLLMAttributes({
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
}

export function evaluateAuditMissionQuality(input: AuditFindingEvalInput) {
  const checks = [
    {
      name: 'findings_present',
      pass: input.findingCount > 0,
      score: input.findingCount > 0 ? 1 : 0
    },
    {
      name: 'issue_candidates_generated',
      pass: input.issueCandidateCount >= 0,
      score: input.issueCandidateCount > 0 ? 1 : 0.5
    },
    {
      name: 'human_review_gate',
      pass: input.hasHumanReviewGate,
      score: input.hasHumanReviewGate ? 1 : 0
    }
  ];

  const score =
    checks.reduce((total, check) => total + check.score, 0) / Math.max(checks.length, 1);

  return {
    evaluator: 'premortem-code-eval',
    auditRunId: input.auditRunId,
    score,
    passed: score >= 0.66,
    checks
  };
}
