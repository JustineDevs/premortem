/**
 * LLM-backed specialist execution adapters for the orchestrator swarm.
 *
 * This layer owns prompt loading, structured-output validation, and token usage persistence.
 */
import type { AgentExecutor, CanonicalFinding, IssueCandidate } from '@premortem/agent-kit';
import { isCanonicalFinding } from '@premortem/agent-kit';
import { DEFAULT_GEMINI_MODEL } from '@premortem/domain';
import { findingEnvelopeSchema, issueEnvelopeSchema } from '@premortem/agent-kit';
import { recordUsageEvent } from '@premortem/db';
import { sanitizePromptPayload } from '@premortem/security';
import {
  captureServerException,
  captureServerMessage,
  getManagedPrompt,
  isLangfuseConfigured
} from '@premortem/observability';
import { createLlmAdapter } from '@premortem/llm';
import type {
  LlmCustomProviderConfig,
  LlmVendorRoutingTierConfig,
  UnifiedLlmAdapterOptions
} from '@premortem/llm';
import { formatAuditWorkflowContract } from '../scheduler/audit-workflow-contract';

export interface LlmExecutorConfig {
  /** Optional model override used for all agent calls in this execution lane. */
  model?: string;
  /** Sampling temperature passed through to the LLM adapter. */
  temperature?: number;
  /** Optional max output token cap for structured generation calls. */
  maxTokens?: number;
  /** Shared workflow contract appended to every agent prompt. */
  workflowContract?: string;
  /** Ordered provider tiers used by the runtime LLM adapter. */
  vendorRouting?: LlmVendorRoutingTierConfig[];
  /** Configured local or hybrid providers available to custom/auto-discovered tiers. */
  customProviders?: LlmCustomProviderConfig[];
}

function readTokenUsage(raw: unknown): { inputTokens: number; outputTokens: number } | null {
  if (!raw || typeof raw !== 'object') return null;
  const value = raw as Record<string, unknown>;

  const usage =
    (value.usage as Record<string, unknown> | undefined) ??
    (value.usageMetadata as Record<string, unknown> | undefined);
  if (usage) {
    const inputTokens = Number(
      usage.inputTokens ?? usage.prompt_tokens ?? usage.promptTokenCount ?? usage.input_token_count ?? 0
    );
    const outputTokens = Number(
      usage.outputTokens ?? usage.completion_tokens ?? usage.candidatesTokenCount ?? usage.output_token_count ?? 0
    );
    if (inputTokens > 0 || outputTokens > 0) {
      return { inputTokens, outputTokens };
    }
  }

  return null;
}

async function persistUsage(context: { payload: Record<string, unknown> }, raw: unknown) {
  const usage = readTokenUsage(raw);
  if (!usage) return;

  const organizationId = typeof context.payload.organizationId === 'string' ? context.payload.organizationId : null;
  if (!organizationId) return;

  const projectId = typeof context.payload.projectId === 'string' ? context.payload.projectId : undefined;
  const auditRunId = typeof context.payload.auditRunId === 'string' ? context.payload.auditRunId : undefined;

  await Promise.all([
    usage.inputTokens > 0
        ? recordUsageEvent({
          organizationId,
          projectId,
          auditRunId,
          eventType: 'tokens_in',
          quantity: usage.inputTokens,
          unit: 'token',
          metadata: { source: 'llm', direction: 'input' }
        })
      : Promise.resolve(),
    usage.outputTokens > 0
        ? recordUsageEvent({
          organizationId,
          projectId,
          auditRunId,
          eventType: 'tokens_out',
          quantity: usage.outputTokens,
          unit: 'token',
          metadata: { source: 'llm', direction: 'output' }
        })
      : Promise.resolve()
  ]);
}

const FINDING_JSON_CONTRACT = [
  'Return JSON only with shape {"findings":[...]}.',
  'Each finding must cite concrete repository file paths from payload.repo_tree in evidence.ref, or source file paths from payload.source_files / payload.source_code_samples when the audit target is an ad hoc snippet.',
  'For ad hoc snippet audits, cite the snippet file path exactly as provided in source_files or source_code_samples.',
  'Never use synthetic repo:// placeholder refs or UUID-only paths.',
  'Use canonical Premortem fields: agent, finding_id, category, finding_type, severity, confidence, predicted_failure, evidence, affected_assets, recommended_controls, dedupe_keys, tags.'
].join('\n');

const ISSUE_JSON_CONTRACT = [
  'Return JSON only with shape {"issues":[...]}.',
  'Each issue must name exact file paths from the input findings in evidence, affected_assets, and predicted_failure_summary, including ad hoc snippet paths when the audit target is a pasted snippet.',
  'Titles must describe a concrete future failure surface, not generic cleanup wording.',
  'Never use synthetic repo:// placeholder refs.',
  'Include source_agents and source_findings for full audit lineage.'
].join('\n');

const SYNTHESIZER_AGENT_NAMES = new Set(['finding_synthesizer_agent', 'issue_validator_agent']);
const DEFAULT_WORKFLOW_CONTRACT = formatAuditWorkflowContract();

function resolveManagedPromptName(agentName: string) {
  return agentName.replace(/_agent$/, '').replace(/_/g, '-');
}

function isNoOutputGeneratedError(error: unknown) {
  return (
    error instanceof Error &&
    (error.name === 'AI_NoOutputGeneratedError' ||
      error.name === 'AI_NoObjectGeneratedError' ||
      /no output generated/i.test(error.message) ||
      /no object generated/i.test(error.message) ||
      /did not match schema/i.test(error.message))
  );
}

function getRetryableHttpStatus(error: unknown): number | null {
  if (!error || typeof error !== 'object') return null;
  const record = error as Record<string, unknown>;
  for (const key of ['status', 'statusCode', 'status_code']) {
    const value = record[key];
    if (typeof value === 'number') return value;
  }

  const cause = record.cause;
  if (cause && typeof cause === 'object') {
    const nested = getRetryableHttpStatus(cause);
    if (nested != null) return nested;
  }

  if (error instanceof Error) {
    const match = error.message.match(/\b(429|500|502|503|504)\b/);
    if (match) return Number.parseInt(match[1]!, 10);
  }

  return null;
}

function isRetryableLlmError(error: unknown): boolean {
  const status = getRetryableHttpStatus(error);
  return status === 429 || (status != null && status >= 500);
}

async function retryTransientLlmCall<T>(operation: () => Promise<T>): Promise<T> {
  const maxAttempts = 3;
  const baseDelayMs = 500;

  let lastError: unknown;
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;
      if (!isRetryableLlmError(error) || attempt === maxAttempts) {
        throw error;
      }

      const delayMs = baseDelayMs * 2 ** (attempt - 1);
      const jitterMs = Math.floor(Math.random() * baseDelayMs);
      await new Promise((resolve) => setTimeout(resolve, delayMs + jitterMs));
    }
  }

  throw lastError instanceof Error ? lastError : new Error('LLM request failed.');
}

async function resolveAgentPrompt(agentName: string, fallback?: string) {
  try {
    const managed: unknown = await getManagedPrompt(resolveManagedPromptName(agentName));
    const resolved =
      typeof managed === 'string'
        ? managed.trim()
        : managed && typeof managed === 'object' && 'prompt' in managed
          ? typeof (managed as { prompt?: unknown }).prompt === 'string'
            ? ((managed as { prompt: string }).prompt).trim()
            : Array.isArray((managed as { prompt?: unknown }).prompt)
              ? JSON.stringify((managed as { prompt: unknown[] }).prompt)
              : ''
          : '';
    if (resolved.length > 0) {
      return resolved;
    }
    if (isLangfuseConfigured()) {
      throw new Error(`Managed prompt for ${agentName} resolved empty text.`);
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (isLangfuseConfigured()) {
      throw new Error(`[${agentName}] managed prompt unavailable: ${message}`);
    }
  }

  const fallbackPrompt = fallback?.trim() ?? '';
  if (fallbackPrompt.length > 0) {
    return fallbackPrompt;
  }

  throw new Error(`Managed prompt for ${agentName} is unavailable.`);
}

function appendWorkflowContract(prompt: string, workflowContract?: string) {
  const contract = workflowContract?.trim() || DEFAULT_WORKFLOW_CONTRACT;
  return contract.length > 0 ? `${prompt.trim()}\n\n${contract}`.trim() : prompt.trim();
}

function parseStructuredOutput<T extends Record<string, unknown>>(
  output: unknown,
  schema: { safeParse: (value: unknown) => { success: true; data: T } | { success: false; error: { message: string } } },
  schemaName: string,
  agentName: string
): T | null {
  if (!output || typeof output !== 'object') {
    captureServerMessage(
      JSON.stringify({
        event: 'llm-structured-output-missing',
        agentName,
        schemaName
      }),
      'warning'
    );
    return null;
  }

  const parsed = schema.safeParse(output);
  if (!parsed.success) {
    captureServerMessage(
      JSON.stringify({
        event: 'llm-structured-output-invalid',
        agentName,
        schemaName,
        error: parsed.error.message
      }),
      'warning'
    );
    return null;
  }

  return parsed.data;
}

function firstSourceSample(payload: Record<string, unknown>) {
  const samples = payload.source_code_samples;
  if (!samples || typeof samples !== 'object' || Array.isArray(samples)) return null;

  for (const [path, value] of Object.entries(samples as Record<string, unknown>)) {
    if (typeof value !== 'string' || value.trim().length === 0) continue;
    return { path, text: value };
  }

  const sourceFiles = payload.source_files;
  if (!Array.isArray(sourceFiles)) return null;

  for (const entry of sourceFiles) {
    if (!entry || typeof entry !== 'object') continue;
    const record = entry as Record<string, unknown>;
    if (typeof record.path !== 'string' || typeof record.preview !== 'string') continue;
    if (record.preview.trim().length === 0) continue;
    return { path: record.path, text: record.preview };
  }

  return null;
}

function createSnippetFallbackFindings(
  agentName: string,
  payload: Record<string, unknown>
): CanonicalFinding[] {
  const sample = firstSourceSample(payload);
  if (!sample) return [];

  const findings: CanonicalFinding[] = [];
  const snippetPath = sample.path;
  const snippetText = sample.text;
  const evidenceRefs = [
    {
      kind: 'file',
      ref: `${snippetPath}:1`,
      reason: 'Pasted audit snippet shows the vulnerable sink in the source sample.'
    },
    {
      kind: 'file',
      ref: `${snippetPath}:2`,
      reason: 'The same snippet includes the surrounding control flow and user-controlled values.'
    }
  ];

  if (
    /(SELECT|INSERT|UPDATE|DELETE|EXEC(?:UTE)?|FROM)\b/i.test(snippetText) &&
    (/(\+|\$\{)/.test(snippetText) || /concat\s*\(/i.test(snippetText))
  ) {
    findings.push({
      agent: agentName,
      finding_id: `adhoc-snippet:sql-injection:${Buffer.from(snippetPath).toString('base64').slice(0, 12)}`,
      category: 'input_validation',
      finding_type: 'sql_injection_risk',
      severity: 'high',
      confidence: 0.92,
      predicted_failure: {
        summary: `String concatenation in ${snippetPath} can turn the pasted SQL path into an injection sink.`,
        failure_mode: 'User-controlled values are interpolated directly into a SQL statement.',
        trigger_conditions: [
          'A caller passes a value containing quote characters or SQL operators.',
          `The query string in ${snippetPath} is built by concatenation instead of parameters.`
        ],
        blast_radius: 'data_store'
      },
      why_it_matters: `The pasted snippet in ${snippetPath} exposes a direct SQL sink that can leak or modify application data.`,
      affected_assets: [snippetPath],
      evidence: evidenceRefs,
      recommended_controls: [
        'Use parameterized queries or a query builder that binds values.',
        'Validate user input before it reaches the database layer.'
      ],
      dedupe_keys: ['adhoc-snippet', 'sql-injection', snippetPath],
      tags: ['adhoc-snippet', 'deterministic-fallback', 'sql-injection']
    });
  }

  if (/(console\.(?:log|warn|error)\s*\([^)]*(password|secret|token)|password\s*[,)]|secret\s*[,)]|token\s*[,)])/i.test(snippetText)) {
    findings.push({
      agent: agentName,
      finding_id: `adhoc-snippet:secret-log:${Buffer.from(`${snippetPath}:secret`).toString('base64').slice(0, 12)}`,
      category: 'secret_exposure',
      finding_type: 'sensitive_data_logging',
      severity: 'medium',
      confidence: 0.9,
      predicted_failure: {
        summary: `The pasted snippet logs a credential-like value in ${snippetPath}, which can leak secrets into console output.`,
        failure_mode: 'A secret or password is emitted to logs during normal execution.',
        trigger_conditions: [
          'The code executes in a production or shared-debug logging environment.',
          `The logging call in ${snippetPath} receives a secret-like variable.`
        ],
        blast_radius: 'component'
      },
      why_it_matters: `Console logging of secret-like data in ${snippetPath} can expose credentials in build logs, server logs, or browser devtools.`,
      affected_assets: [snippetPath],
      evidence: evidenceRefs,
      recommended_controls: [
        'Remove the secret from the log statement or replace it with a redacted placeholder.',
        'Add a unit test or lint rule that blocks credential-like values from reaching logs.'
      ],
      dedupe_keys: ['adhoc-snippet', 'secret-exposure', snippetPath],
      tags: ['adhoc-snippet', 'deterministic-fallback', 'secret-exposure']
    });
  }

  return findings;
}

function createFallbackIssueCandidates(
  findings: CanonicalFinding[],
  payload: Record<string, unknown>
): IssueCandidate[] {
  if (findings.length === 0) return [];

  const grouped = new Map<string, CanonicalFinding[]>();
  for (const finding of findings) {
    const key = finding.category?.trim() || 'repository_surface';
    grouped.set(key, [...(grouped.get(key) ?? []), finding]);
  }

  const candidates: IssueCandidate[] = [...grouped.entries()].map(([category, items]) => {
    const primaryAsset = items[0]?.affected_assets[0] ?? category;
    const sourceAgents = [
      ...new Set(
        items
          .map((item) => item.agent)
          .filter((agent): agent is string => typeof agent === 'string' && agent.trim().length > 0)
      )
    ];
    const sourceFindings = items
      .map((item) => item.finding_id)
      .filter((findingId): findingId is string => typeof findingId === 'string' && findingId.trim().length > 0);
    const evidence = items.flatMap((item) => item.evidence ?? []);
    const triggerConditions = items
      .flatMap((item) => item.predicted_failure?.trigger_conditions ?? [])
      .filter((entry): entry is string => typeof entry === 'string' && entry.trim().length > 0)
      .slice(0, 4);
    const categoryLabel = category.replaceAll('_', ' ');

    return {
      title: `Harden ${categoryLabel} around \`${primaryAsset}\` before the next production rollout`,
      category,
      severity: items.some((item) => item.severity === 'high' || item.severity === 'critical') ? 'high' : 'medium',
      confidence: 0.9,
      predicted_failure_summary: `Changes to \`${primaryAsset}\` can break ${categoryLabel} during routine delivery in this repository path.`,
      why_it_matters: `Multiple specialist signals converge on \`${primaryAsset}\` as the remediation surface for ${categoryLabel}.`,
      trigger_conditions:
        triggerConditions.length >= 2
          ? triggerConditions
          : [
              `Changes to ${primaryAsset} can still reach review without a gate.`,
              `The ${categoryLabel} path still lacks a safe rollback check.`
            ],
      evidence: evidence.slice(0, 4),
      recommended_action_summary: `Add durable controls around \`${primaryAsset}\` and related ${categoryLabel} paths before the next production change.`,
      implementation_steps: [
        `Add a CI validation gate covering \`${primaryAsset}\`.`,
        `Document ownership and regression checks for ${categoryLabel} boundaries.`,
        `Verify blast radius on branch promotion before publish.`
      ],
      done_criteria: [
        `${categoryLabel} changes fail safely in CI when the contract breaks.`,
        `Owners can verify blast radius for \`${primaryAsset}\` before publish.`,
        `Regression coverage exists for the listed trigger conditions.`
      ],
      affected_assets: [...new Set(items.flatMap((item) => item.affected_assets))],
      source_agents: sourceAgents.length > 0 ? sourceAgents : ['finding_synthesizer_agent'],
      source_findings: sourceFindings
    } satisfies IssueCandidate;
  });

  if (candidates.length === 0) {
    const sample = firstSourceSample(payload);
    if (!sample) return [];

    const categoryLabel = 'snippet review';
    return [
      {
        title: `Harden \`${sample.path}\` before the next production rollout`,
        category: 'adhoc_snippet',
        severity: 'high',
        confidence: 0.9,
        predicted_failure_summary: `The pasted snippet in \`${sample.path}\` still needs a durable control before production use in this repository path.`,
        why_it_matters: `The snippet at \`${sample.path}\` is part of a live audit surface and should not remain review-unverified.`,
        trigger_conditions: [
          `The pasted snippet at ${sample.path} is reused in production without a regression gate.`,
          'The audit pipeline cannot point reviewers to a grounded follow-up action.'
        ],
        evidence: [
          {
            kind: 'file',
            ref: `${sample.path}:1`,
            reason: 'Pasted snippet supplied to the audit pipeline.'
          }
        ],
        recommended_action_summary: `Add durable controls around \`${sample.path}\` and related ${categoryLabel} paths before the next production change.`,
        implementation_steps: [
          `Review the pasted snippet in \`${sample.path}\` for the unsafe control flow.`,
          'Add regression coverage for the snippet path before publish.'
        ],
        done_criteria: [
          'The snippet is represented by a reviewable issue candidate.',
          'Reviewers can trace the finding back to the pasted source text.'
        ],
        affected_assets: [sample.path],
        source_agents: ['finding_synthesizer_agent'],
        source_findings: [sample.path]
      }
    ];
  }

  return candidates;
}

/**
 * Build a set of executor implementations that preserve the agent contract:
 * specialist agents emit canonical findings, synthesizers emit issue candidates.
 *
 * @param promptByAgent - Per-agent system prompt text loaded from the prompt registry.
 * @param config - Optional model, temperature, and token limits for the lane.
 * @returns A name-keyed executor map used by the worker registry.
 */
export function createLlmExecutors(
  promptByAgent: Record<string, string>,
  config?: LlmExecutorConfig
): Record<string, AgentExecutor> {
  const llm = createLlmAdapter({
    vendorRouting: config?.vendorRouting,
    customProviders: config?.customProviders
  } satisfies UnifiedLlmAdapterOptions);
  const model = config?.model ?? process.env.LLM_MODEL ?? DEFAULT_GEMINI_MODEL;
  const temperature = config?.temperature ?? 0.2;
  const maxOutputTokens = config?.maxTokens;
  const workflowContract = config?.workflowContract;

  const specialist = (agentName: string): AgentExecutor => ({
    kind: 'specialist',
    run: async (context) => {
      try {
        const systemPrompt = await resolveAgentPrompt(agentName, promptByAgent[agentName] ?? '');
        const result = await retryTransientLlmCall(() =>
          llm.generateObject({
            model,
            temperature,
            maxOutputTokens,
            schema: findingEnvelopeSchema,
            messages: [
              {
                role: 'system',
                content: `${appendWorkflowContract(systemPrompt, workflowContract)}\n\n${FINDING_JSON_CONTRACT}`
              },
              { role: 'user', content: JSON.stringify(sanitizePromptPayload(context.payload)) }
            ]
          })
        );
        void persistUsage(context, result.raw).catch((error) => {
          captureServerException(error, {
            surface: 'llm-usage-persistence',
            agentName
          });
        });
        const parsed = parseStructuredOutput(result.output, findingEnvelopeSchema, 'findingEnvelope', agentName);
        const findings = parsed?.findings ?? [];
        if (findings.length > 0) {
          return findings;
        }

        if (agentName === 'security_prediction_agent') {
          return createSnippetFallbackFindings(agentName, context.payload);
        }

        return findings;
      } catch (error) {
        if (isNoOutputGeneratedError(error)) {
          if (agentName === 'security_prediction_agent') {
            captureServerMessage(
              JSON.stringify({
                event: 'llm-no-output-fallback',
                agentName,
                reason: 'Using deterministic snippet fallback after empty model output.'
              }),
              'warning'
            );
            return createSnippetFallbackFindings(agentName, context.payload);
          }
          captureServerMessage(
            JSON.stringify({
              event: 'llm-no-output',
              agentName,
              error: error instanceof Error ? error.message : String(error)
            }),
            'warning'
          );
          return [];
        }
        throw error;
      }
    }
  });

  const synth = (agentName: string): AgentExecutor => ({
    kind: 'synthesizer',
    run: async (context, findings) => {
      const canonicalFindings = findings.filter(isCanonicalFinding);
      try {
        const systemPrompt = await resolveAgentPrompt(agentName, promptByAgent[agentName] ?? '');
        const result = await retryTransientLlmCall(() =>
          llm.generateObject({
            model,
            temperature,
            maxOutputTokens,
            schema: issueEnvelopeSchema,
            messages: [
              {
                role: 'system',
                content: `${appendWorkflowContract(systemPrompt, workflowContract)}\n\n${ISSUE_JSON_CONTRACT}`
              },
              {
                role: 'user',
                content: JSON.stringify(
                  sanitizePromptPayload({
                    payload: context.payload,
                    findings
                  })
                )
              }
            ]
          })
        );
        void persistUsage(context, result.raw).catch((error) => {
          captureServerException(error, {
            surface: 'llm-usage-persistence',
            agentName
          });
        });
        const parsed = parseStructuredOutput(result.output, issueEnvelopeSchema, 'issueEnvelope', agentName);
        const issues = parsed?.issues ?? [];
        if (issues.length > 0) {
          return issues;
        }

        const fallbackIssues = createFallbackIssueCandidates(canonicalFindings, context.payload);
        if (fallbackIssues.length > 0) {
          captureServerMessage(
            JSON.stringify({
              event: 'llm-issue-fallback',
              agentName,
              issueCount: fallbackIssues.length
            }),
            'warning'
          );
          return fallbackIssues;
        }

        return issues;
      } catch (error) {
        if (isNoOutputGeneratedError(error)) {
          const fallbackIssues = createFallbackIssueCandidates(canonicalFindings, context.payload);
          if (fallbackIssues.length > 0) {
            captureServerMessage(
              JSON.stringify({
                event: 'llm-no-output-fallback',
                agentName,
                reason: 'Using deterministic issue fallback after empty model output.',
                issueCount: fallbackIssues.length
              }),
              'warning'
            );
            return fallbackIssues;
          }
          captureServerMessage(
            JSON.stringify({
              event: 'llm-no-output',
              agentName,
              error: error instanceof Error ? error.message : String(error)
            }),
            'warning'
          );
          return [];
        }
        throw error;
      }
    }
  });

  const executors: Record<string, AgentExecutor> = {};

  for (const agentName of Object.keys(promptByAgent)) {
    executors[agentName] = SYNTHESIZER_AGENT_NAMES.has(agentName)
      ? synth(agentName)
      : specialist(agentName);
  }

  return executors;
}
