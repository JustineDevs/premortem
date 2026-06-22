import type { AgentExecutor, CanonicalFinding } from '@premortem/agent-kit';
import {
  isCanonicalFinding,
  isIssueCandidate,
  makeMockFinding,
  synthesizeMockIssues
} from '@premortem/agent-kit';

const specialistCategories: Record<string, string> = {
  repo_topology_agent: 'topology',
  ci_regression_agent: 'ci_regression',
  cross_repo_boundary_agent: 'cross_repo_boundary',
  release_safety_agent: 'release_safety',
  integration_boundary_agent: 'integration_boundary',
  supply_chain_vulnerability_agent: 'supply_chain_vulnerability',
  artifact_integrity_agent: 'artifact_integrity',
  api_deprecation_risk_agent: 'api_deprecation_risk',
  trust_boundary_agent: 'trust_boundary',
  security_threat_model_agent: 'security_threat_model',
  onboarding_operability_agent: 'onboarding_operability',
  db_migration_safety_agent: 'db_migration_safety',
  config_drift_agent: 'config_drift',
  secret_rotation_risk_agent: 'secret_rotation_risk',
  test_adequacy_agent: 'test_adequacy',
  performance_slo_agent: 'performance_slo',
  observability_recovery_agent: 'observability_recovery',
  orchestrator_analysis_agent: 'orchestrator_analysis',
  dependency_supply_chain_agent: 'dependency_supply_chain',
  ownership_change_risk_agent: 'ownership_change_risk',
  issue_memory_agent: 'issue_memory',
  product_gap_agent: 'product_gap'
};

interface GitLabIssueSummary {
  iid: number;
  title: string;
  state: string;
  labels: string[];
  updatedAt: string;
  webUrl: string;
}

interface GitLabCiHistorySummary {
  pipelines: Array<{ id: number; status: string; failedJobs: Array<{ stage: string; name: string }> }>;
  totals: { sampled: number; failed: number; success: number; successRate: number };
  recentFailedStages: string[];
}

function issueMemoryFindings(payload: Record<string, unknown>): CanonicalFinding[] {
  const existingIssues = (payload.existing_issues as GitLabIssueSummary[] | undefined) ?? [];
  const ciHistory = payload.ci_history as GitLabCiHistorySummary | undefined;
  const findings: CanonicalFinding[] = [];

  for (const issue of existingIssues.slice(0, 5)) {
    const base = makeMockFinding('issue_memory_agent', 'issue_memory', payload);
    findings.push({
      ...base,
      finding_id: `issue_memory:gitlab-iid-${issue.iid}`,
      predicted_failure: {
        ...base.predicted_failure,
        summary: `Open GitLab issue #${issue.iid} may recur: ${issue.title}`,
        trigger_conditions: [
          `Issue #${issue.iid} remains open with labels ${issue.labels.join(', ') || 'none'}.`,
          `Last updated ${issue.updatedAt}.`
        ]
      },
      evidence: [
        {
          kind: 'issue',
          ref: issue.webUrl,
          reason: 'Open GitLab issue matches current risk memory surface.'
        },
        {
          kind: 'file',
          ref: `gitlab://issues/${issue.iid}`,
          reason: `Issue state ${issue.state} indicates unresolved delivery risk.`
        }
      ],
      dedupe_keys: ['issue_memory', `gitlab-iid-${issue.iid}`, ...base.dedupe_keys],
      tags: [...base.tags, 'gitlab-issue-memory']
    });
  }

  const failedStages = ciHistory?.recentFailedStages ?? [];
  if (failedStages.length > 0) {
    const base = makeMockFinding('issue_memory_agent', 'issue_memory', payload);
    const stageEvidence = failedStages.map((stage) => ({
      kind: 'pipeline' as const,
      ref: `ci-stage:${stage}`,
      reason: 'Recent GitLab pipeline history shows repeated stage failures.'
    }));
    while (stageEvidence.length < 2) {
      stageEvidence.push({
        kind: 'pipeline',
        ref: `ci-stage:${failedStages[0] ?? 'unknown'}-history`,
        reason: 'Pipeline history sampling shows recurring instability in this stage.'
      });
    }
    findings.push({
      ...base,
      finding_id: `issue_memory:ci-failures:${failedStages.join('|')}`,
      predicted_failure: {
        ...base.predicted_failure,
        summary: `Recent CI failures repeat in stages: ${failedStages.join(', ')}.`,
        blast_radius: 'pipeline'
      },
      evidence: stageEvidence,
      dedupe_keys: ['issue_memory', 'ci-history', ...failedStages],
      tags: [...base.tags, 'ci-history-memory']
    });
  }

  if (findings.length === 0) {
    return [makeMockFinding('issue_memory_agent', 'issue_memory', payload)];
  }

  return findings;
}

export function createDefaultExecutors(): Record<string, AgentExecutor> {
  const executors: Record<string, AgentExecutor> = {};

  for (const [agentName, category] of Object.entries(specialistCategories)) {
    if (agentName === 'issue_memory_agent') {
      executors[agentName] = {
        kind: 'specialist',
        run: async (context) => issueMemoryFindings(context.payload)
      };
      continue;
    }

    executors[agentName] = {
      kind: 'specialist',
      run: async (context) => [makeMockFinding(agentName, category, context.payload)]
    };
  }

  executors.finding_synthesizer_agent = {
    kind: 'synthesizer',
    run: async (_context, findings) => synthesizeMockIssues(findings.filter(isCanonicalFinding))
  };

  executors.issue_validator_agent = {
    kind: 'synthesizer',
    run: async (_context, inputs) => {
      const issues = inputs.filter(isIssueCandidate);
      if (issues.length > 0) {
        return issues.map((issue) => ({ ...issue }));
      }

      return synthesizeMockIssues(inputs.filter(isCanonicalFinding));
    }
  };

  return executors;
}
