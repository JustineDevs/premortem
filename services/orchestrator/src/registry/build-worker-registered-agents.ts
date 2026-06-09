import type { RegisteredAgent } from '@premortem/agent-kit';
import { createDefaultExecutors } from '../executors/default-executors';

const WORKER_AGENT_DEFINITIONS = [
  {
    name: 'repo_topology_agent',
    description: 'Maps code topology, dependency hotspots, centrality, and brittle boundaries.',
    runMode: 'always',
    promptPath: '.agents/prompts/repo-topology.md',
    mergeOwnerPriority: 70,
    prompt: `# Repo Topology Agent

You are the Repo Topology Agent for Premortem.

## Objective
Find structural risks in repository topology that make future incidents more likely, harder to contain, or harder to debug. Focus on dependency hubs, circular coupling, ambiguous ownership seams, cross-package leakage, and central modules whose failure would spread quickly.
`
  },
  {
    name: 'release_safety_agent',
    description: 'Detects rollback gaps, rollout hazards, migration risks, and unsafe deploy sequences.',
    runMode: 'always',
    promptPath: '.agents/prompts/release-safety.md',
    mergeOwnerPriority: 100,
    prompt: `# Release Safety Agent

You are the Release Safety Agent for Premortem.

## Objective
Detect deploy and release designs that can push bad changes into production without safe rollback, isolation, verification, or migration discipline.
`
  },
  {
    name: 'integration_boundary_agent',
    description: 'Finds contract drift, schema mismatch, hidden coupling, and boundary assumptions.',
    runMode: 'always',
    promptPath: '.agents/prompts/integration-boundary.md',
    mergeOwnerPriority: 90,
    prompt: `# Integration Boundary Agent

You are the Integration Boundary Agent for Premortem.

## Objective
Find future failures caused by drift or mismatch across interfaces: API clients, schema contracts, DTOs, events, queues, or generated clients.
`
  },
  {
    name: 'artifact_integrity_agent',
    description: 'Detects stale generated artifacts and codegen/source-of-truth drift.',
    runMode: 'conditional',
    promptPath: '.agents/prompts/artifact-integrity.md',
    mergeOwnerPriority: 85,
    prompt: `# Artifact Integrity Agent

You are the Artifact Integrity Agent for Premortem.

## Objective
Detect stale generated artifacts, codegen drift, vendored output mismatch, and build-time source-of-truth confusion.
`
  },
  {
    name: 'trust_boundary_agent',
    description: 'Detects unsafe secret handling, token scope problems, and trust-boundary failures.',
    runMode: 'always',
    promptPath: '.agents/prompts/trust-boundary.md',
    mergeOwnerPriority: 95,
    prompt: `# Trust Boundary Agent

You are the Trust Boundary Agent for Premortem.

## Objective
Find failure risks around secret handling, token scope, privileged automation, environment trust assumptions, and broken isolation boundaries.
`
  },
  {
    name: 'onboarding_operability_agent',
    description: 'Detects broken local setup, undocumented prerequisites, and fragile contributor workflows.',
    runMode: 'always',
    promptPath: '.agents/prompts/onboarding-operability.md',
    mergeOwnerPriority: 75,
    prompt: `# Onboarding Operability Agent

You are the Onboarding Operability Agent for Premortem.

## Objective
Detect hidden setup fragility that causes new contributors or fresh environments to fail, drift, or produce inconsistent results.
`
  },
  {
    name: 'test_adequacy_agent',
    description: 'Evaluates whether critical failure paths are actually covered by tests.',
    runMode: 'always',
    promptPath: '.agents/prompts/test-adequacy.md',
    mergeOwnerPriority: 80,
    prompt: `# Test Adequacy Agent

You are the Test Adequacy Agent for Premortem.

## Objective
Find critical failure paths that are under-tested, untested, or only covered by tests that would miss the real break condition.
`
  },
  {
    name: 'observability_recovery_agent',
    description: 'Detects missing health signals, silent failure modes, and weak recovery paths.',
    runMode: 'conditional',
    promptPath: '.agents/prompts/observability-recovery.md',
    mergeOwnerPriority: 78,
    prompt: `# Observability Recovery Agent

You are the Observability Recovery Agent for Premortem.

## Objective
Detect silent failure modes, missing health signals, weak alertability, and poor recovery pathways that turn recoverable incidents into prolonged outages.
`
  },
  {
    name: 'dependency_supply_chain_agent',
    description: 'Detects dependency chokepoints, unsafe upgrades, and supply-chain fragility.',
    runMode: 'conditional',
    promptPath: '.agents/prompts/dependency-supply-chain.md',
    mergeOwnerPriority: 77,
    prompt: `# Dependency Supply Chain Agent

You are the Dependency Supply Chain Agent for Premortem.

## Objective
Find future reliability risks caused by fragile or concentrated third-party dependencies, unsafe upgrade posture, and package graph choke points.
`
  },
  {
    name: 'ownership_change_risk_agent',
    description: 'Finds no-owner hotspots, churn-heavy critical paths, and unstable boundaries.',
    runMode: 'conditional',
    promptPath: '.agents/prompts/ownership-change-risk.md',
    mergeOwnerPriority: 72,
    prompt: `# Ownership Change Risk Agent

You are the Ownership Change Risk Agent for Premortem.

## Objective
Identify change-risk hotspots where churn, unclear ownership, or historical fragility make future incidents more likely.
`
  },
  {
    name: 'issue_memory_agent',
    description: 'Links past incidents and prior findings to current risks.',
    runMode: 'conditional',
    promptPath: '.agents/prompts/issue-memory.md',
    mergeOwnerPriority: 50,
    prompt: `# Issue Memory Agent

You are the Issue Memory Agent for Premortem.

## Objective
Connect current risk signals to prior incidents, recurring issue classes, and historical remediation failures so the system does not rediscover the same lessons repeatedly.
`
  },
  {
    name: 'finding_synthesizer_agent',
    description: 'Clusters specialist findings into high-signal issue candidates.',
    runMode: 'always',
    promptPath: '.agents/prompts/finding-synthesizer.md',
    mergeOwnerPriority: 999,
    prompt: `# Finding Synthesizer Agent

You are the Finding Synthesizer Agent for Premortem.

## Objective
Convert clusters of specialist findings into a smaller set of high-signal, actionable issue candidates suitable for human review and GitLab publication.
`
  },
  {
    name: 'issue_validator_agent',
    description: 'Rejects weak, generic, under-evidenced, or non-actionable issue candidates.',
    runMode: 'always',
    promptPath: '.agents/prompts/issue-validator.md',
    mergeOwnerPriority: 1000,
    prompt: `# Issue Validator Agent

You are the Issue Validator Agent for Premortem.

## Objective
Reject issue candidates that are vague, duplicative, weakly evidenced, not testable, or not publication-ready.
`
  }
] as const satisfies Array<
  Pick<RegisteredAgent, 'name' | 'description' | 'runMode' | 'promptPath' | 'prompt' | 'mergeOwnerPriority'>
>;

export function buildWorkerRegisteredAgents(): RegisteredAgent[] {
  const executors = createDefaultExecutors();

  return WORKER_AGENT_DEFINITIONS.map((definition) => {
    const executor = executors[definition.name];
    if (!executor) {
      throw new Error(`Missing executor for worker registry agent: ${definition.name}`);
    }

    return {
      ...definition,
      executor
    };
  });
}
