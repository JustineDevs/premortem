import type { AgentExecutor } from '@premortem/agent-kit';
import { makeMockFinding, synthesizeMockIssues } from '@premortem/agent-kit';

const specialistCategories: Record<string, string> = {
  repo_topology_agent: 'topology',
  release_safety_agent: 'release_safety',
  integration_boundary_agent: 'integration_boundary',
  artifact_integrity_agent: 'artifact_integrity',
  trust_boundary_agent: 'trust_boundary',
  onboarding_operability_agent: 'onboarding_operability',
  test_adequacy_agent: 'test_adequacy',
  observability_recovery_agent: 'observability_recovery',
  dependency_supply_chain_agent: 'dependency_supply_chain',
  ownership_change_risk_agent: 'ownership_change_risk',
  issue_memory_agent: 'issue_memory'
};

export function createDefaultExecutors(): Record<string, AgentExecutor> {
  const executors: Record<string, AgentExecutor> = {};

  for (const [agentName, category] of Object.entries(specialistCategories)) {
    executors[agentName] = {
      kind: 'specialist',
      run: async (context) => [makeMockFinding(agentName, category, context.payload)]
    };
  }

  executors.finding_synthesizer_agent = {
    kind: 'synthesizer',
    run: async (_context, findings) => synthesizeMockIssues(findings)
  };

  executors.issue_validator_agent = {
    kind: 'synthesizer',
    run: async (_context, findings) => synthesizeMockIssues(findings)
  };

  return executors;
}
