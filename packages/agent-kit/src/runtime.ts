import type { CanonicalFinding, IssueCandidate } from './types';

export interface AgentContext {
  projectId: string;
  auditRunId: string;
  payload: Record<string, unknown>;
}

export interface SpecialistAgent {
  name: string;
  run(context: AgentContext): Promise<CanonicalFinding[]>;
}

export interface SynthesizerAgent {
  name: string;
  run(findings: CanonicalFinding[]): Promise<IssueCandidate[]>;
}
