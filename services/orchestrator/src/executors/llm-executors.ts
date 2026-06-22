/**
 * LLM-backed specialist execution adapters for the orchestrator swarm.
 *
 * This layer owns prompt loading, structured-output validation, and token usage persistence.
 */
import type { AgentExecutor } from '@premortem/agent-kit';
import { DEFAULT_GEMINI_MODEL } from '@premortem/domain';
import { findingEnvelopeSchema, issueEnvelopeSchema } from '@premortem/agent-kit';
import { recordUsageEvent } from '@premortem/db';
import { sanitizePromptPayload } from '@premortem/security';
import { captureServerException, getManagedPrompt } from '@premortem/observability';
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
  'Each finding must cite concrete repository file paths from payload.repo_tree in evidence.ref.',
  'Never use synthetic repo:// placeholder refs or UUID-only paths.',
  'Use canonical Premortem fields: agent, finding_id, category, finding_type, severity, confidence, predicted_failure, evidence, affected_assets, recommended_controls, dedupe_keys, tags.'
].join('\n');

const ISSUE_JSON_CONTRACT = [
  'Return JSON only with shape {"issues":[...]}.',
  'Each issue must name exact file paths from the input findings in evidence, affected_assets, and predicted_failure_summary.',
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
    (error.name === 'AI_NoOutputGeneratedError' || /no output generated/i.test(error.message))
  );
}

async function resolveAgentPrompt(agentName: string, fallback: string) {
  const managed = await getManagedPrompt(resolveManagedPromptName(agentName), {
    fallback
  });
  return typeof managed === 'string' && managed.trim().length > 0 ? managed.trim() : fallback;
}

function appendWorkflowContract(prompt: string, workflowContract?: string) {
  const contract = workflowContract?.trim() || DEFAULT_WORKFLOW_CONTRACT;
  return contract.length > 0 ? `${prompt.trim()}\n\n${contract}`.trim() : prompt.trim();
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
        const result = await llm.generateObject({
          model,
          temperature,
          maxOutputTokens,
          schema: findingEnvelopeSchema,
          messages: [
            { role: 'system', content: `${appendWorkflowContract(systemPrompt, workflowContract)}\n\n${FINDING_JSON_CONTRACT}` },
            { role: 'user', content: JSON.stringify(sanitizePromptPayload(context.payload)) }
          ]
        });
        void persistUsage(context, result.raw).catch((error) => {
          captureServerException(error, {
            surface: 'llm-usage-persistence',
            agentName
          });
        });
        return findingEnvelopeSchema.parse(result.output).findings;
      } catch (error) {
        if (isNoOutputGeneratedError(error)) {
          captureServerException(error, {
            surface: 'llm-no-output',
            agentName
          });
          return [];
        }
        throw error;
      }
    }
  });

  const synth = (agentName: string): AgentExecutor => ({
    kind: 'synthesizer',
    run: async (context, findings) => {
      try {
        const systemPrompt = await resolveAgentPrompt(agentName, promptByAgent[agentName] ?? '');
        const result = await llm.generateObject({
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
        });
        void persistUsage(context, result.raw).catch((error) => {
          captureServerException(error, {
            surface: 'llm-usage-persistence',
            agentName
          });
        });
        return issueEnvelopeSchema.parse(result.output).issues;
      } catch (error) {
        if (isNoOutputGeneratedError(error)) {
          captureServerException(error, {
            surface: 'llm-no-output',
            agentName
          });
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
