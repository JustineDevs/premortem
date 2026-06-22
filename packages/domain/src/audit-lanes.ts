/** Premortem runs exactly two parallel audit lanes (not user-configurable). */
export const AUDIT_PARALLEL_LANE_COUNT = 2 as const;

export type AuditParallelLaneId = 'structure' | 'runtime';

export interface AuditParallelLane {
  id: AuditParallelLaneId;
  label: string;
  description: string;
}

export const AUDIT_PARALLEL_LANES: readonly AuditParallelLane[] = [
  {
    id: 'structure',
    label: 'Repository Graph',
    description: 'Static topology, dependency hubs, artifacts, and test coverage signals.'
  },
  {
    id: 'runtime',
    label: 'Pipeline Trace',
    description: 'Release safety, trust boundaries, operability, and recovery paths.'
  }
] as const;

export const STRUCTURE_LANE_AGENTS = [
  'repo_topology_agent',
  'cross_repo_boundary_agent',
  'dependency_supply_chain_agent',
  'supply_chain_vulnerability_agent',
  'artifact_integrity_agent',
  'api_deprecation_risk_agent',
  'test_adequacy_agent',
  'integration_boundary_agent',
  'product_gap_agent'
] as const;

export const RUNTIME_LANE_AGENTS = [
  'ci_regression_agent',
  'release_safety_agent',
  'trust_boundary_agent',
  'security_threat_model_agent',
  'onboarding_operability_agent',
  'db_migration_safety_agent',
  'config_drift_agent',
  'secret_rotation_risk_agent',
  'performance_slo_agent',
  'observability_recovery_agent',
  'orchestrator_analysis_agent',
  'ownership_change_risk_agent',
  'issue_memory_agent'
] as const;

export function auditLaneForAgent(agentName: string): AuditParallelLaneId | null {
  if ((STRUCTURE_LANE_AGENTS as readonly string[]).includes(agentName)) return 'structure';
  if ((RUNTIME_LANE_AGENTS as readonly string[]).includes(agentName)) return 'runtime';
  return null;
}

export type WorkflowCanvasViewMode = 'graph' | 'split' | 'workbench';

export const WORKFLOW_CANVAS_STEPS = [
  { id: 'node-connect-vcs', index: 0, defaultViewMode: 'split' as WorkflowCanvasViewMode },
  { id: 'node-scan-repo', index: 1, defaultViewMode: 'split' as WorkflowCanvasViewMode },
  { id: 'node-run-audit', index: 2, defaultViewMode: 'split' as WorkflowCanvasViewMode },
  { id: 'node-cluster-risks', index: 3, defaultViewMode: 'workbench' as WorkflowCanvasViewMode },
  { id: 'node-review-approval', index: 4, defaultViewMode: 'workbench' as WorkflowCanvasViewMode },
  { id: 'node-publish-gitlab', index: 5, defaultViewMode: 'workbench' as WorkflowCanvasViewMode }
] as const;

export function defaultViewModeForStep(stepIndex: number): WorkflowCanvasViewMode {
  if (stepIndex <= 2) return 'split';
  return 'workbench';
}
