import type { AgentExecutor, CanonicalFinding, IssueCandidate } from '@premortem/agent-kit';
import { isCanonicalFinding, isIssueCandidate } from '@premortem/agent-kit';
import { isProductionMode } from '@premortem/domain';

function hash(input: string) {
  let value = 0;
  for (let index = 0; index < input.length; index += 1) {
    value = (value * 31 + input.charCodeAt(index)) >>> 0;
  }
  return value;
}

function repoTreeFromPayload(payload: Record<string, unknown>): string[] {
  if (!Array.isArray(payload.repo_tree)) return [];
  return payload.repo_tree.filter((entry): entry is string => typeof entry === 'string');
}

function pickRepoPaths(payload: Record<string, unknown>, category: string, count = 2): string[] {
  const tree = repoTreeFromPayload(payload).filter(
    (filePath) =>
      filePath.includes('.') &&
      !filePath.startsWith('.git/') &&
      !filePath.includes('node_modules/') &&
      !filePath.endsWith('.lock')
  );
  if (tree.length === 0) return [];

  const keywords = category.split('_').filter(Boolean);
  const matched = tree.filter((filePath) => {
    const lower = filePath.toLowerCase();
    return keywords.some((keyword) => lower.includes(keyword));
  });

  const pool = matched.length >= count ? matched : tree;
  const seed = hash(`${category}:${String(payload.projectId ?? '')}:${String(payload.branch ?? '')}`);
  const start = seed % Math.max(pool.length - count, 1);
  return pool.slice(start, start + count);
}

function makeMockFinding(agent: string, category: string, payload: Record<string, unknown>): CanonicalFinding {
  const projectId = String(payload.projectId ?? 'project');
  const branch = String(payload.branch ?? 'main');
  const seed = hash(`${agent}:${projectId}:${branch}`);
  const repoPaths = pickRepoPaths(payload, category, 2);
  const primaryPath = repoPaths[0] ?? `${category}/boundary.ts`;
  const secondaryPath = repoPaths[1] ?? `${category}/config.yml`;

  return {
    agent,
    finding_id: `${agent}:${projectId}:${branch}`,
    category,
    finding_type: `${category}_risk`,
    severity: seed % 5 === 0 ? 'high' : 'medium',
    confidence: 0.72,
    predicted_failure: {
      summary: `Changes to \`${primaryPath}\` on \`${branch}\` can break ${category.replaceAll('_', ' ')} controls during routine delivery.`,
      failure_mode: `Unowned ${category.replaceAll('_', ' ')} boundary fails under normal deployment churn.`,
      trigger_conditions: [
        `A merge updates \`${primaryPath}\` without boundary validation.`,
        `Branch \`${branch}\` is promoted without verifying dependent paths in \`${secondaryPath}\`.`
      ],
      blast_radius: seed % 5 === 0 ? 'pipeline' : 'component'
    },
    why_it_matters: `The ${category.replaceAll('_', ' ')} surface around \`${primaryPath}\` can fail after merge while appearing healthy during review.`,
    affected_assets: [primaryPath, secondaryPath, `${projectId}:${branch}`],
    evidence: [
      {
        kind: 'file',
        ref: primaryPath,
        reason: `Primary ${category.replaceAll('_', ' ')} hotspot appears central to the change path.`
      },
      {
        kind: 'config',
        ref: secondaryPath,
        reason: 'Supporting config path lacks a strong verification control.'
      }
    ],
    recommended_controls: [
      `Add explicit ${category.replaceAll('_', ' ')} boundary checks in CI for \`${primaryPath}\`.`,
      `Assign ownership and test gates to \`${secondaryPath}\`.`
    ],
    dedupe_keys: [category, primaryPath, branch],
    tags: [agent, category, 'mock-runtime']
  };
}

function synthesizeMockIssues(findings: CanonicalFinding[]): IssueCandidate[] {
  const grouped = new Map<string, CanonicalFinding[]>();
  for (const finding of findings) {
    const key = finding.category;
    grouped.set(key, [...(grouped.get(key) ?? []), finding]);
  }

  return [...grouped.entries()].map(([category, items]) => {
    const primaryAsset = items[0]?.affected_assets[0] ?? category;
    const agents = [
      ...new Set(items.map((item) => item.agent).filter((agent): agent is string => typeof agent === 'string' && agent.length > 0))
    ];
    const categoryLabel = category.replaceAll('_', ' ');
    const evidence = items.flatMap((item) => item.evidence ?? []);
    const sourceFindings = items
      .map((item) => item.finding_id)
      .filter((findingId): findingId is string => typeof findingId === 'string' && findingId.length > 0);

    return {
      title: `Harden ${categoryLabel} around \`${primaryAsset}\` before the next production rollout`,
      category,
      severity: items.some((item) => item.severity === 'high') ? 'high' : 'medium',
      confidence: 0.78,
      predicted_failure_summary: `Changes to \`${primaryAsset}\` can break ${categoryLabel} during routine delivery.`,
      why_it_matters: `Multiple specialist signals converge on \`${primaryAsset}\` as the remediation surface for ${categoryLabel}.`,
      trigger_conditions: items.flatMap((item) => item.predicted_failure?.trigger_conditions ?? []).slice(0, 4),
      evidence: evidence.slice(0, 4),
      recommended_action_summary: `Add durable controls around \`${primaryAsset}\` and related ${categoryLabel} paths before the next production change.`,
      implementation_steps: [
        `Add a CI validation gate covering \`${primaryAsset}\`.`,
        `Document ownership and regression checks for ${categoryLabel} boundaries.`,
        `Verify blast radius on branch promotion before publish.`
      ],
      done_criteria: [
        `${categoryLabel} changes fail safely in CI when the contract breaks.`,
        `Owners can verify blast radius for \`${primaryAsset}\` before publish.`,
        `Regression coverage exists for the listed trigger conditions.`
      ],
      affected_assets: [...new Set(items.flatMap((item) => item.affected_assets))],
      source_agents: agents,
      source_findings: sourceFindings
    };
  });
}

const specialistCategories: Record<string, string> = {
  repo_topology_agent: 'topology',
  ci_regression_agent: 'ci_regression',
  cross_repo_boundary_agent: 'cross_repo_boundary',
  release_safety_agent: 'release_safety',
  integration_boundary_agent: 'integration_boundary',
  supply_chain_vulnerability_agent: 'supply_chain_vulnerability',
  security_prediction_agent: 'security_prediction',
  threat_model_agent: 'threat_model',
  llm_security_agent: 'llm_security',
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
  product_gap_agent: 'product_gap',
  pr_diff_agent: 'pr_diff_review'
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

interface MergeRequestDiffChange {
  oldPath: string;
  newPath: string;
  diff: string;
  newFile: boolean;
  renamedFile: boolean;
  deletedFile: boolean;
}

interface MergeRequestReviewContext {
  iid: number;
  title?: string;
  sourceBranch?: string;
  targetBranch?: string;
  sha?: string;
  webUrl?: string;
  action?: string;
  changedFileCount: number;
  diffSnippet: string;
  changes?: MergeRequestDiffChange[];
}

function normalizeDiffPath(change: MergeRequestDiffChange) {
  return change.newPath || change.oldPath;
}

function mergeRequestRiskProfile(path: string, diffText: string): {
  category: string;
  severity: CanonicalFinding['severity'];
  confidence: number;
  label: string;
  reason: string;
} {
  const lower = `${path}\n${diffText}`.toLowerCase();

  if (/(auth|oauth|token|session|permission|rbac|acl|role|sso|saml|mfa|login|signup)/.test(lower)) {
    return {
      category: 'pr_diff_authorization',
      severity: 'high',
      confidence: 0.92,
      label: 'authorization and session control',
      reason: 'The change touches authentication, authorization, or identity control surfaces.'
    };
  }

  if (/(stripe|billing|invoice|subscription|checkout|portal|meter|plan|quota|refund)/.test(lower)) {
    return {
      category: 'pr_diff_billing',
      severity: 'high',
      confidence: 0.91,
      label: 'billing and entitlements',
      reason: 'The change touches billing, plan enforcement, or monetization flow.'
    };
  }

  if (/(secret|password|token|key|env|vault|credential|private)/.test(lower)) {
    return {
      category: 'pr_diff_secret_handling',
      severity: 'critical',
      confidence: 0.95,
      label: 'secret handling',
      reason: 'The change touches secret material or credential lifecycle.'
    };
  }

  if (/(webhook|callback|signature|mcp|event|reconcile|sync)/.test(lower)) {
    return {
      category: 'pr_diff_integration',
      severity: 'high',
      confidence: 0.84,
      label: 'integration and webhook handling',
      reason: 'The change touches an integration boundary that can drift silently.'
    };
  }

  if (/(schema|prisma|migration|sql|db|rls|table|index|query)/.test(lower)) {
    return {
      category: 'pr_diff_schema',
      severity: 'high',
      confidence: 0.86,
      label: 'schema and query behavior',
      reason: 'The change touches persistence, query shape, or row-level controls.'
    };
  }

  if (/(api\/|route|handler|endpoint|cors|redirect|headers|fetch|request)/.test(lower)) {
    return {
      category: 'pr_diff_api_surface',
      severity: 'medium',
      confidence: 0.76,
      label: 'API surface behavior',
      reason: 'The change touches a request handler or exposed API surface.'
    };
  }

  return {
    category: 'pr_diff_review_surface',
    severity: 'medium',
    confidence: 0.62,
    label: 'review surface',
    reason: 'The merge request contains changed code that should be reviewed against policy and regression risk.'
  };
}

function mergeRequestDiffFindings(payload: Record<string, unknown>): CanonicalFinding[] {
  const mergeRequest = payload.merge_request as MergeRequestReviewContext | undefined;
  if (!mergeRequest || typeof mergeRequest.iid !== 'number') return [];

  const changes = Array.isArray(mergeRequest.changes) ? mergeRequest.changes : [];
  const findings: CanonicalFinding[] = [];
  const candidateChanges = changes
    .map((change) => {
      const path = normalizeDiffPath(change);
      if (!path) return null;
      const diffText = [path, change.diff ?? ''].join('\n');
      return {
        path,
        profile: mergeRequestRiskProfile(path, diffText),
        diffText,
        change
      };
    })
    .filter((entry): entry is NonNullable<typeof entry> => Boolean(entry));

  for (const entry of candidateChanges.slice(0, 10)) {
    const findingId = `pr_diff:${mergeRequest.iid}:${hash(`${entry.path}:${entry.profile.category}`)}`;
    findings.push({
      agent: 'pr_diff_agent',
      finding_id: findingId,
      category: entry.profile.category,
      finding_type: 'merge_request_diff_risk',
      severity: entry.profile.severity,
      confidence: entry.profile.confidence,
      predicted_failure: {
        summary: `Merge request !${mergeRequest.iid} changes ${entry.path} in the ${entry.profile.label} surface.`,
        failure_mode: `A merge request diff can introduce regressions in ${entry.profile.label} without a dedicated review gate.`,
        trigger_conditions: [
          `Merge request !${mergeRequest.iid} modifies \`${entry.path}\`.`,
          entry.profile.reason
        ],
        blast_radius: entry.profile.severity === 'critical' ? 'pipeline' : 'component'
      },
      why_it_matters: `CodeRabbit-style diff review should catch ${entry.profile.label} issues before the full audit runs.`,
      affected_assets: [entry.path, mergeRequest.webUrl ?? `gitlab://merge-request/${mergeRequest.iid}`],
      evidence: [
        {
          kind: 'file',
          ref: entry.path,
          reason: entry.change.diff?.trim().length
            ? 'Directly observed in the merge request diff.'
            : 'The merge request changed this file path.'
        },
        {
          kind: 'issue',
          ref: mergeRequest.webUrl ?? `gitlab://merge-request/${mergeRequest.iid}`,
          reason: `GitLab merge request !${mergeRequest.iid} is the source of this review signal.`
        }
      ],
      recommended_controls: [
        `Add regression coverage or policy checks for \`${entry.path}\` before merge.`,
        `Require review attention for ${entry.profile.label} changes on merge request !${mergeRequest.iid}.`
      ],
      dedupe_keys: ['pr_diff_review', String(mergeRequest.iid), entry.profile.category, entry.path],
      tags: ['merge-request-review', 'pr-diff', 'code-rabbit-style']
    });
  }

  if (findings.length === 0 && mergeRequest.changedFileCount > 0) {
    findings.push({
      agent: 'pr_diff_agent',
      finding_id: `pr_diff:${mergeRequest.iid}:surface`,
      category: 'pr_diff_review_surface',
      finding_type: 'merge_request_diff_risk',
      severity: 'medium',
      confidence: 0.58,
      predicted_failure: {
        summary: `Merge request !${mergeRequest.iid} changed ${mergeRequest.changedFileCount} files and should be reviewed for hidden behavior drift.`,
        failure_mode: 'A non-obvious change can alter behavior without direct ownership of the impacted contract.',
        trigger_conditions: [
          `Merge request !${mergeRequest.iid} contains code changes.`,
          'No higher-signal file-specific risk matched the diff heuristic.'
        ],
        blast_radius: 'component'
      },
      why_it_matters: 'Diff-level review should still run even when the change does not trip a specific risk heuristic.',
      affected_assets: [mergeRequest.webUrl ?? `gitlab://merge-request/${mergeRequest.iid}`],
      evidence: [
        {
          kind: 'issue',
          ref: mergeRequest.webUrl ?? `gitlab://merge-request/${mergeRequest.iid}`,
          reason: 'The merge request contains changed files that warrant structured review.'
        }
      ],
      recommended_controls: [
        'Inspect the merge request diff for contract, authorization, and data-flow drift.',
        'Add explicit approval criteria for the changed surface before merge.'
      ],
      dedupe_keys: ['pr_diff_review', String(mergeRequest.iid), 'surface'],
      tags: ['merge-request-review', 'pr-diff']
    });
  }

  return findings;
}

function issueMemoryFindings(payload: Record<string, unknown>): CanonicalFinding[] {
  const priorFindings = (payload.prior_findings as Array<{ fact: string; valid_at: string | null }> | undefined) ?? [];
  const existingIssues = (payload.existing_issues as GitLabIssueSummary[] | undefined) ?? [];
  const ciHistory = payload.ci_history as GitLabCiHistorySummary | undefined;
  const findings: CanonicalFinding[] = [];

  for (const edge of priorFindings.slice(0, 10)) {
    const hash = Buffer.from(edge.fact, 'utf8').toString('base64').replace(/=+$/g, '').slice(0, 16);
    findings.push({
      agent: 'issue_memory_agent',
      finding_id: `issue_memory:graphiti:${hash}`,
      category: 'issue_memory',
      finding_type: 'issue_memory_risk',
      severity: 'medium',
      confidence: 0.82,
      predicted_failure: {
        summary: edge.fact,
        failure_mode: 'A historical failure pattern reappears during a future audit or release.',
        trigger_conditions: [
          edge.valid_at ? `First observed: ${edge.valid_at}.` : 'Historical pattern from prior audits.',
          'Pattern recurred across multiple audit runs for this project.'
        ],
        blast_radius: 'component'
      },
      why_it_matters: 'Graphiti temporal memory links the current project to a repeated failure class.',
      affected_assets: ['graphiti://episode', 'graphiti://prior-audit'],
      evidence: [
        {
          kind: 'graphiti',
          ref: 'graphiti://episode',
          reason: 'Extracted from Graphiti temporal knowledge graph.'
        },
        {
          kind: 'graphiti',
          ref: 'graphiti://prior-audit',
          reason: 'Fact derived from prior audit findings.'
        }
      ],
      recommended_controls: [
        'Trace the repeated pattern back to the earliest audit that introduced it.',
        'Add a durable regression check for the recurring failure class.'
      ],
      dedupe_keys: ['issue_memory', 'graphiti', edge.fact.slice(0, 40)],
      tags: ['graphiti-memory', 'cross-audit']
    });
  }

  for (const issue of existingIssues.slice(0, 5)) {
    findings.push({
      agent: 'issue_memory_agent',
      finding_id: `issue_memory:gitlab-iid-${issue.iid}`,
      category: 'issue_memory',
      finding_type: 'issue_memory_risk',
      severity: issue.state === 'opened' ? 'high' : 'medium',
      confidence: 0.74,
      predicted_failure: {
        summary: `Open GitLab issue #${issue.iid} may recur: ${issue.title}`,
        failure_mode: 'An unresolved issue class resurfaces in a later audit.',
        trigger_conditions: [
          `Issue #${issue.iid} remains ${issue.state} with labels ${issue.labels.join(', ') || 'none'}.`,
          `Last updated ${issue.updatedAt}.`
        ],
        blast_radius: 'component'
      },
      why_it_matters: 'Open issue history points to a still-unresolved delivery risk.',
      affected_assets: [issue.webUrl, `gitlab://issues/${issue.iid}`],
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
      recommended_controls: [
        'Close the loop on the referenced issue with an explicit regression test.',
        'Link the issue to the owning file or module before the next release.'
      ],
      dedupe_keys: ['issue_memory', `gitlab-iid-${issue.iid}`],
      tags: ['gitlab-issue-memory']
    });
  }

  const failedStages = ciHistory?.recentFailedStages ?? [];
  if (failedStages.length > 0) {
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
      finding_id: `issue_memory:ci-failures:${failedStages.join('|')}`,
      agent: 'issue_memory_agent',
      category: 'issue_memory',
      finding_type: 'issue_memory_risk',
      severity: 'medium',
      confidence: 0.76,
      predicted_failure: {
        summary: `Recent CI failures repeat in stages: ${failedStages.join(', ')}.`,
        failure_mode: 'Repeated pipeline instability can mask regressions and delay remediation.',
        trigger_conditions: [
          `Recent failures hit stages: ${failedStages.join(', ')}.`,
          'The same stage fails across repeated audit runs.'
        ],
        blast_radius: 'pipeline'
      },
      why_it_matters: 'Pipeline recurrence signals an unresolved delivery control gap.',
      affected_assets: failedStages.map((stage) => `ci-stage:${stage}`),
      evidence: stageEvidence,
      recommended_controls: [
        'Add coverage or runtime checks for the failing stage.',
        'Block promotion until the stage becomes stable across repeated runs.'
      ],
      dedupe_keys: ['issue_memory', 'ci-history', ...failedStages],
      tags: ['ci-history-memory']
    });
  }

  if (findings.length === 0) {
    return [];
  }

  return findings;
}

export function createDefaultExecutors(): Record<string, AgentExecutor> {
  if (isProductionMode() && process.env.PREMORTEM_EXECUTOR === 'mock') {
    throw new Error('PREMORTEM_EXECUTOR=mock is not allowed in production mode.');
  }

  const executors: Record<string, AgentExecutor> = {};

  for (const [agentName, category] of Object.entries(specialistCategories)) {
    if (agentName === 'issue_memory_agent') {
      executors[agentName] = {
        kind: 'specialist',
        run: async (context) => issueMemoryFindings(context.payload)
      };
      continue;
    }

    if (agentName === 'pr_diff_agent') {
      executors[agentName] = {
        kind: 'specialist',
        run: async (context) => mergeRequestDiffFindings(context.payload)
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
