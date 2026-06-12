import { loadPrompt, type RegisteredAgent } from '@premortem/agent-kit';
import { isProductionMode } from '@premortem/domain';
import { createDefaultExecutors } from '../executors/default-executors';
import { createLlmExecutors, type LlmExecutorConfig } from '../executors/llm-executors';

const WORKER_AGENT_DEFINITIONS = [
  {
    name: 'repo_topology_agent',
    description: 'Maps code topology, dependency hotspots, centrality, and brittle boundaries.',
    runMode: 'always' as const,
    promptPath: '.agents/prompts/repo-topology.md',
    mergeOwnerPriority: 70
  },
  {
    name: 'release_safety_agent',
    description: 'Detects rollback gaps, rollout hazards, migration risks, and unsafe deploy sequences.',
    runMode: 'always' as const,
    promptPath: '.agents/prompts/release-safety.md',
    mergeOwnerPriority: 100
  },
  {
    name: 'integration_boundary_agent',
    description: 'Finds contract drift, schema mismatch, hidden coupling, and boundary assumptions.',
    runMode: 'always' as const,
    promptPath: '.agents/prompts/integration-boundary.md',
    mergeOwnerPriority: 90
  },
  {
    name: 'artifact_integrity_agent',
    description: 'Detects stale generated artifacts and codegen/source-of-truth drift.',
    runMode: 'conditional' as const,
    promptPath: '.agents/prompts/artifact-integrity.md',
    mergeOwnerPriority: 85
  },
  {
    name: 'trust_boundary_agent',
    description: 'Detects unsafe secret handling, token scope problems, and trust-boundary failures.',
    runMode: 'always' as const,
    promptPath: '.agents/prompts/trust-boundary.md',
    mergeOwnerPriority: 95
  },
  {
    name: 'onboarding_operability_agent',
    description: 'Detects broken local setup, undocumented prerequisites, and fragile contributor workflows.',
    runMode: 'always' as const,
    promptPath: '.agents/prompts/onboarding-operability.md',
    mergeOwnerPriority: 75
  },
  {
    name: 'test_adequacy_agent',
    description: 'Evaluates whether critical failure paths are actually covered by tests.',
    runMode: 'always' as const,
    promptPath: '.agents/prompts/test-adequacy.md',
    mergeOwnerPriority: 80
  },
  {
    name: 'dependency_supply_chain_agent',
    description: 'Detects risky dependency drift, stale packages, and supply-chain exposure.',
    runMode: 'conditional' as const,
    promptPath: '.agents/prompts/dependency-supply-chain.md',
    mergeOwnerPriority: 65
  },
  {
    name: 'observability_recovery_agent',
    description: 'Detects missing telemetry, rollback visibility, and incident recovery gaps.',
    runMode: 'always' as const,
    promptPath: '.agents/prompts/observability-recovery.md',
    mergeOwnerPriority: 88
  },
  {
    name: 'ownership_change_risk_agent',
    description: 'Detects weak ownership, bus factor, and orphaned critical paths.',
    runMode: 'conditional' as const,
    promptPath: '.agents/prompts/ownership-change-risk.md',
    mergeOwnerPriority: 60
  },
  {
    name: 'issue_memory_agent',
    description: 'Links past incidents and prior findings to current risks.',
    runMode: 'conditional' as const,
    promptPath: '.agents/prompts/issue-memory.md',
    mergeOwnerPriority: 50
  },
  {
    name: 'finding_synthesizer_agent',
    description: 'Clusters specialist findings into high-signal issue candidates.',
    runMode: 'always' as const,
    promptPath: '.agents/prompts/finding-synthesizer.md',
    mergeOwnerPriority: 999
  },
  {
    name: 'issue_validator_agent',
    description: 'Rejects weak, generic, under-evidenced, or non-actionable issue candidates.',
    runMode: 'always' as const,
    promptPath: '.agents/prompts/issue-validator.md',
    mergeOwnerPriority: 1000
  }
] as const;

function resolveExecutors(rootDir: string, llmConfig?: LlmExecutorConfig) {
  const mode =
    process.env.PREMORTEM_EXECUTOR ??
    (process.env.GEMINI_API_KEY || process.env.AZURE_OPENAI_API_KEY ? 'llm' : 'mock');

  if (mode === 'mock' && isProductionMode()) {
    throw new Error(
      'PREMORTEM_PRODUCTION_MODE=1 requires a real LLM executor. Configure GEMINI_API_KEY or Azure OpenAI and unset PREMORTEM_EXECUTOR=mock.'
    );
  }

  if (mode === 'llm') {
    if (process.env.PREMORTEM_SMOKE_SKIP_LLM_SPECIALISTS === '1') {
      return createDefaultExecutors();
    }

    const promptByAgent = Object.fromEntries(
      WORKER_AGENT_DEFINITIONS.map((definition) => [
        definition.name,
        loadPrompt(rootDir, definition.promptPath)
      ])
    );
    const llmExecutors = createLlmExecutors(promptByAgent, llmConfig);
    return llmExecutors;
  }
  return createDefaultExecutors();
}

export function buildWorkerRegisteredAgents(rootDir?: string, llmConfig?: LlmExecutorConfig): RegisteredAgent[] {
  const resolvedRoot = rootDir ?? process.env.PREMORTEM_ROOT_DIR ?? process.cwd();
  const executors = resolveExecutors(resolvedRoot, llmConfig);

  return WORKER_AGENT_DEFINITIONS.map((definition) => {
    const executor = executors[definition.name];
    if (!executor) {
      throw new Error(`Missing executor for worker registry agent: ${definition.name}`);
    }

    return {
      ...definition,
      prompt: loadPrompt(resolvedRoot, definition.promptPath),
      executor
    };
  });
}
