/**
 * Worker registry for the orchestrator swarm.
 *
 * This registry binds each prompt to a named agent, analysis role, and executor
 * implementation so the runtime can swap between mock and LLM-backed lanes.
 */
import { loadPrompt, resolveAgentAnalysisRole, type RegisteredAgent } from '@premortem/agent-kit';
import { hasConfiguredRuntimeCredentials, isProductionMode } from '@premortem/domain';
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
    name: 'ci_regression_agent',
    description: 'Detects flaky CI behavior, masked failures, and regression-prone delivery sequences.',
    runMode: 'conditional' as const,
    promptPath: '.agents/prompts/ci-regression.md',
    mergeOwnerPriority: 96
  },
  {
    name: 'cross_repo_boundary_agent',
    description: 'Detects risks that span shared packages, consumers, providers, and repo boundaries.',
    runMode: 'conditional' as const,
    promptPath: '.agents/prompts/cross-repo-boundary.md',
    mergeOwnerPriority: 89
  },
  {
    name: 'supply_chain_vulnerability_agent',
    description: 'Detects dependency vulnerabilities, risky upgrades, and supply-chain exposure.',
    runMode: 'conditional' as const,
    promptPath: '.agents/prompts/supply-chain-vulnerability.md',
    mergeOwnerPriority: 87
  },
  {
    name: 'artifact_integrity_agent',
    description: 'Detects stale generated artifacts and codegen/source-of-truth drift.',
    runMode: 'conditional' as const,
    promptPath: '.agents/prompts/artifact-integrity.md',
    mergeOwnerPriority: 85
  },
  {
    name: 'api_deprecation_risk_agent',
    description: 'Detects breaking endpoint, field, and compatibility risks for internal and external clients.',
    runMode: 'conditional' as const,
    promptPath: '.agents/prompts/api-deprecation-risk.md',
    mergeOwnerPriority: 86
  },
  {
    name: 'trust_boundary_agent',
    description: 'Detects unsafe secret handling, token scope problems, and trust-boundary failures.',
    runMode: 'always' as const,
    promptPath: '.agents/prompts/trust-boundary.md',
    mergeOwnerPriority: 95
  },
  {
    name: 'security_threat_model_agent',
    description: 'Detects STRIDE and privacy threats across auth, data flow, and trust boundaries.',
    runMode: 'conditional' as const,
    promptPath: '.agents/prompts/security-threat-model.md',
    mergeOwnerPriority: 94
  },
  {
    name: 'onboarding_operability_agent',
    description: 'Detects broken local setup, undocumented prerequisites, and fragile contributor workflows.',
    runMode: 'always' as const,
    promptPath: '.agents/prompts/onboarding-operability.md',
    mergeOwnerPriority: 75
  },
  {
    name: 'db_migration_safety_agent',
    description: 'Detects schema evolution hazards, backward-compatibility breaks, and rollback gaps.',
    runMode: 'conditional' as const,
    promptPath: '.agents/prompts/db-migration-safety.md',
    mergeOwnerPriority: 98
  },
  {
    name: 'config_drift_agent',
    description: 'Detects environment, deployment, and runtime config drift across surfaces.',
    runMode: 'conditional' as const,
    promptPath: '.agents/prompts/config-drift.md',
    mergeOwnerPriority: 83
  },
  {
    name: 'secret_rotation_risk_agent',
    description: 'Detects long-lived credentials, missing rotation coverage, and revocation gaps.',
    runMode: 'conditional' as const,
    promptPath: '.agents/prompts/secret-rotation-risk.md',
    mergeOwnerPriority: 97
  },
  {
    name: 'test_adequacy_agent',
    description: 'Evaluates whether critical failure paths are actually covered by tests.',
    runMode: 'always' as const,
    promptPath: '.agents/prompts/test-adequacy.md',
    mergeOwnerPriority: 80
  },
  {
    name: 'performance_slo_agent',
    description: 'Detects latency bottlenecks, missing SLOs, throughput risks, and weak alerting.',
    runMode: 'conditional' as const,
    promptPath: '.agents/prompts/performance-slo.md',
    mergeOwnerPriority: 84
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
    name: 'orchestrator_analysis_agent',
    description: 'Detects sequencing, queue, checkpoint, and retry risks in the orchestrator itself.',
    runMode: 'conditional' as const,
    promptPath: '.agents/prompts/orchestrator-analysis.md',
    mergeOwnerPriority: 97
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
    name: 'product_gap_agent',
    description: 'Detects missing user-visible capabilities and spec-versus-implementation mismatches.',
    runMode: 'conditional' as const,
    promptPath: '.agents/prompts/product-gap.md',
    mergeOwnerPriority: 55
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
    (hasConfiguredRuntimeCredentials() ? 'llm' : 'mock');

  if (mode === 'mock' && isProductionMode()) {
    throw new Error(
      'PREMORTEM_PRODUCTION_MODE=1 requires a real LLM executor. Configure GEMINI_API_KEY, OPENAI_API_KEY, or ANTHROPIC_API_KEY and unset PREMORTEM_EXECUTOR=mock.'
    );
  }

  if (mode === 'llm') {
    const workflowContract = loadPrompt(rootDir, '.agents/prompts/workflow-contract.md');
    const promptByAgent = Object.fromEntries(
      WORKER_AGENT_DEFINITIONS.map((definition) => [
        definition.name,
        loadPrompt(rootDir, definition.promptPath)
      ])
    );
    const llmExecutors = createLlmExecutors(promptByAgent, {
      ...llmConfig,
      workflowContract
    });
    return llmExecutors;
  }
  return createDefaultExecutors();
}

/**
 * Build the canonical worker agent roster used by the orchestrator.
 *
 * @param rootDir - Repository root used to resolve prompt files.
 * @param llmConfig - Optional model and temperature overrides for the LLM lane.
 * @returns Ordered worker registrations with prompts, executors, and analysis roles.
 */
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
      analysisRole: resolveAgentAnalysisRole(definition.name),
      prompt: loadPrompt(resolvedRoot, definition.promptPath),
      executor
    };
  });
}
