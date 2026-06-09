export type AgentRunMode = 'always' | 'conditional';

export type FindingSeverity = 'low' | 'medium' | 'high' | 'critical';

export interface EvidenceRef {
  kind: string;
  ref: string;
  reason: string;
}

export interface CanonicalFinding {
  agent: string;
  finding_id: string;
  category: string;
  finding_type: string;
  severity: FindingSeverity;
  confidence: number;
  predicted_failure: {
    summary: string;
    failure_mode?: string;
    trigger_conditions: string[];
    blast_radius?: string;
  };
  why_it_matters?: string;
  affected_assets: string[];
  evidence: EvidenceRef[];
  recommended_controls: string[];
  dedupe_keys: string[];
  tags: string[];
}

export interface IssueCandidate {
  title: string;
  category: string;
  severity: FindingSeverity;
  confidence: number;
  predicted_failure_summary: string;
  why_it_matters: string;
  trigger_conditions: string[];
  evidence: EvidenceRef[];
  recommended_action_summary: string;
  implementation_steps: string[];
  done_criteria: string[];
  affected_assets: string[];
  source_agents: string[];
  source_findings: string[];
}
