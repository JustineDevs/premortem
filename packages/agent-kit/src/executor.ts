import fs from 'node:fs';
import path from 'node:path';
import { resolveAgentAnalysisRole } from './types';
import { loadRegistry, type AgentRegistry } from './registry';
import type { AgentAnalysisRole, CanonicalFinding, IssueCandidate } from './types';

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
  run: (
    context: AgentExecutionContext,
    inputs: Array<CanonicalFinding | IssueCandidate>
  ) => Promise<IssueCandidate[]>;
}

export type AgentExecutor = SpecialistExecutor | SynthesizerExecutor;

export interface RegisteredAgent {
  name: string;
  description: string;
  runMode: 'always' | 'conditional';
  analysisRole: AgentAnalysisRole;
  promptPath: string;
  prompt: string;
  mergeOwnerPriority: number;
  executor: AgentExecutor;
}

const SPECIALIST_FLOOR_PROMPT_PATH = '.agents/prompts/specialist-floor.md';

function shouldApplySpecialistFloor(promptPath: string) {
  return (
    promptPath !== SPECIALIST_FLOOR_PROMPT_PATH &&
    !promptPath.endsWith('/workflow-contract.md') &&
    !promptPath.endsWith('\\workflow-contract.md')
  );
}

export function loadPrompt(rootDir: string, promptPath: string) {
  const prompt = fs.readFileSync(path.join(rootDir, promptPath), 'utf8').trim();
  if (!shouldApplySpecialistFloor(promptPath)) {
    return prompt;
  }

  const floorPath = path.join(rootDir, SPECIALIST_FLOOR_PROMPT_PATH);
  if (!fs.existsSync(floorPath)) {
    return prompt;
  }

  const floor = fs.readFileSync(floorPath, 'utf8').trim();
  return `${floor}\n\n${prompt}`.trim();
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
      analysisRole: agent.analysis_role ?? resolveAgentAnalysisRole(agent.name),
      promptPath: agent.prompt,
      prompt: loadPrompt(input.rootDir, agent.prompt),
      mergeOwnerPriority: agent.merge_owner_priority,
      executor
    };
  });
}
