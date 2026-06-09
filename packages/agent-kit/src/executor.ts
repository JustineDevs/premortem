import fs from 'node:fs';
import path from 'node:path';
import { loadRegistry, type AgentRegistry } from './registry';
import type { CanonicalFinding, IssueCandidate } from './types';

export interface AgentExecutionContext {
  rootDir: string;
  projectId: string;
  auditRunId: string;
  payload: Record<string, unknown>;
}

export interface SpecialistExecutor {
  kind: 'specialist';
  run: (context: AgentExecutionContext) => Promise<CanonicalFinding[]>;
}

export interface SynthesizerExecutor {
  kind: 'synthesizer';
  run: (context: AgentExecutionContext, findings: CanonicalFinding[]) => Promise<IssueCandidate[]>;
}

export type AgentExecutor = SpecialistExecutor | SynthesizerExecutor;

export interface RegisteredAgent {
  name: string;
  description: string;
  runMode: 'always' | 'conditional';
  promptPath: string;
  prompt: string;
  mergeOwnerPriority: number;
  executor: AgentExecutor;
}

export function loadPrompt(rootDir: string, promptPath: string) {
  return fs.readFileSync(path.join(rootDir, promptPath), 'utf8');
}

export function createRegisteredAgents(input: {
  rootDir: string;
  registry?: AgentRegistry;
  executors: Record<string, AgentExecutor>;
}): RegisteredAgent[] {
  const registry = input.registry ?? loadRegistry(input.rootDir);

  return registry.agents.map((agent) => {
    const executor = input.executors[agent.name];
    if (!executor) {
      throw new Error(`Missing executor for registry agent: ${agent.name}`);
    }

    return {
      name: agent.name,
      description: agent.description,
      runMode: agent.run_mode,
      promptPath: agent.prompt,
      prompt: loadPrompt(input.rootDir, agent.prompt),
      mergeOwnerPriority: agent.merge_owner_priority,
      executor
    };
  });
}
