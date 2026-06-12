import type { AgentExecutor } from '@premortem/agent-kit';
import { DEFAULT_GEMINI_MODEL } from '@premortem/domain';
import { parseFindingEnvelope, parseIssueEnvelope, synthesizeMockIssues } from '@premortem/agent-kit';
import { recordUsageEvent } from '@premortem/db';
import { createLlmAdapter } from '@premortem/llm';

export interface LlmExecutorConfig {
  model?: string;
  temperature?: number;
  maxTokens?: number;
}

function readTokenUsage(raw: unknown): { inputTokens: number; outputTokens: number } | null {
  if (!raw || typeof raw !== 'object') return null;
  const value = raw as Record<string, unknown>;

  const geminiUsage = value.usageMetadata as Record<string, unknown> | undefined;
  if (geminiUsage) {
    const inputTokens = Number(geminiUsage.promptTokenCount ?? 0);
    const outputTokens = Number(geminiUsage.candidatesTokenCount ?? 0);
    if (inputTokens > 0 || outputTokens > 0) {
      return { inputTokens, outputTokens };
    }
  }

  const azureUsage = value.usage as Record<string, unknown> | undefined;
  if (azureUsage) {
    const inputTokens = Number(azureUsage.prompt_tokens ?? 0);
    const outputTokens = Number(azureUsage.completion_tokens ?? 0);
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

export function createLlmExecutors(
  promptByAgent: Record<string, string>,
  config?: LlmExecutorConfig
): Record<string, AgentExecutor> {
  const llm = createLlmAdapter();
  const model = config?.model ?? process.env.LLM_MODEL ?? DEFAULT_GEMINI_MODEL;
  const temperature = config?.temperature ?? 0.2;

  const specialist = (agentName: string): AgentExecutor => ({
    kind: 'specialist',
    run: async (context) => {
      const result = await llm.generate({
        model,
        temperature,
        messages: [
          { role: 'system', content: `${promptByAgent[agentName] ?? ''}\n\n${FINDING_JSON_CONTRACT}` },
          { role: 'user', content: JSON.stringify(context.payload) }
        ]
      });
      void persistUsage(context, result.raw).catch((error) => {
        console.warn(
          `[${agentName}] usage persistence failed:`,
          error instanceof Error ? error.message : error
        );
      });
      try {
        return parseFindingEnvelope(result.text);
      } catch (error) {
        console.warn(
          `[${agentName}] finding parse failed; continuing with empty findings:`,
          error instanceof Error ? error.message : error
        );
        return [];
      }
    }
  });

  const synth = (agentName: string): AgentExecutor => ({
    kind: 'synthesizer',
    run: async (context, findings) => {
      const result = await llm.generate({
        model,
        temperature,
        messages: [
          {
            role: 'system',
            content: `${promptByAgent[agentName] ?? ''}\n\n${ISSUE_JSON_CONTRACT}`
          },
          { role: 'user', content: JSON.stringify({ payload: context.payload, findings }) }
        ]
      });
      void persistUsage(context, result.raw).catch((error) => {
        console.warn(
          `[${agentName}] usage persistence failed:`,
          error instanceof Error ? error.message : error
        );
      });
      try {
        return parseIssueEnvelope(result.text);
      } catch (error) {
        if (agentName === 'finding_synthesizer_agent') {
          console.warn(
            `[${agentName}] issue parse failed; falling back to deterministic synthesis:`,
            error instanceof Error ? error.message : error
          );
          return synthesizeMockIssues(findings);
        }
        throw error;
      }
    }
  });

  return {
    repo_topology_agent: specialist('repo_topology_agent'),
    release_safety_agent: specialist('release_safety_agent'),
    integration_boundary_agent: specialist('integration_boundary_agent'),
    artifact_integrity_agent: specialist('artifact_integrity_agent'),
    trust_boundary_agent: specialist('trust_boundary_agent'),
    onboarding_operability_agent: specialist('onboarding_operability_agent'),
    test_adequacy_agent: specialist('test_adequacy_agent'),
    observability_recovery_agent: specialist('observability_recovery_agent'),
    dependency_supply_chain_agent: specialist('dependency_supply_chain_agent'),
    ownership_change_risk_agent: specialist('ownership_change_risk_agent'),
    issue_memory_agent: specialist('issue_memory_agent'),
    finding_synthesizer_agent: synth('finding_synthesizer_agent'),
    issue_validator_agent: synth('issue_validator_agent')
  };
}
