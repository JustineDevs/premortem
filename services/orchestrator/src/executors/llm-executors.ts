import type { AgentExecutor } from '@premortem/agent-kit';
import { DEFAULT_GEMINI_MODEL } from '@premortem/domain';
import { parseFindingEnvelope, parseIssueEnvelope, synthesizeMockIssues } from '@premortem/agent-kit';
import { createLlmAdapter } from '@premortem/llm';

export interface LlmExecutorConfig {
  model?: string;
  temperature?: number;
  maxTokens?: number;
}

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
          { role: 'system', content: promptByAgent[agentName] ?? '' },
          { role: 'user', content: JSON.stringify(context.payload) }
        ]
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
          { role: 'system', content: promptByAgent[agentName] ?? '' },
          { role: 'user', content: JSON.stringify({ payload: context.payload, findings }) }
        ]
      });
      try {
        return parseIssueEnvelope(result.text);
      } catch (error) {
        if (agentName === 'finding_synthesizer_agent' && findings.length > 0) {
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
