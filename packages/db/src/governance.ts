import type {
  EvalProvider,
  EvalRunStatus,
  FixVerificationStatus,
  PolicyDecisionOutcome,
  Prisma,
  PublishedIssueLinkRelationType,
  RiskIntentSource,
  RiskIntentStatus,
  RiskIntentType
} from '@prisma/client';

import { prisma } from './client';

export interface RiskIntentCandidate {
  type: RiskIntentType;
  source: RiskIntentSource;
  summary: string;
  evidence: Prisma.InputJsonValue;
  detectedFrom: Prisma.InputJsonValue;
  confidence: number;
  expiresAt?: Date | null;
}

export interface PolicyPackSnapshot {
  id: string;
  name: string;
  scope: string;
  status: string;
  rules: unknown;
  decisionCriteria: unknown;
  metadata: unknown;
}

function clampConfidence(value: number) {
  if (!Number.isFinite(value)) return 0.5;
  return Math.min(1, Math.max(0, value));
}

function normalizeText(value: string) {
  return value.toLowerCase().replace(/\s+/g, ' ').trim();
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function asStringList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((entry): entry is string => typeof entry === 'string');
}

function summarizePolicyRules(plan: string) {
  return [
    {
      id: 'critical-fast-track',
      match: { severities: ['critical', 'high'] },
      outcome: 'show_now',
      rationale: 'High severity issues are surfaced immediately so release risk is not hidden.'
    },
    {
      id: 'accepted-debt-batch',
      match: { intentTypes: ['accepted_debt', 'deliberate_shortcut'] },
      outcome: 'batch_later',
      rationale: 'Explicitly accepted debt stays visible but is grouped so it does not overwhelm the queue.'
    },
    {
      id: 'temporary-workaround-review',
      match: { intentTypes: ['temporary_workaround', 'migration_in_progress'] },
      outcome: 'batch_later',
      rationale: 'Temporary workarounds should stay on the radar until the migration is complete.'
    },
    {
      id: 'known-limitation-suppress',
      match: { intentTypes: ['known_limitation'] },
      outcome: plan === 'enterprise' ? 'batch_later' : 'suppress',
      rationale:
        'Documented limitations are suppressed or batched depending on the operating plan to reduce reviewer fatigue.'
    }
  ];
}

function summarizePolicyCriteria(plan: string) {
  return {
    plan,
    kpi: plan === 'enterprise' ? 'review throughput and compliance latency' : 'review throughput',
    slo:
      plan === 'enterprise'
        ? 'critical issues visible same day, accepted debt reviewed weekly'
        : 'critical issues visible immediately, accepted debt reviewed with the next queue pass',
    queueSize:
      plan === 'enterprise'
        ? 'bounded by policy pack and reviewer capacity'
        : 'bounded by current audit queue and risk intensity'
  };
}

function collectTextSignals(input: string): RiskIntentCandidate[] {
  const normalized = normalizeText(input);
  const signals: RiskIntentCandidate[] = [];

  const pushSignal = (
    type: RiskIntentType,
    source: RiskIntentSource,
    summary: string,
    evidence: Prisma.InputJsonValue,
    confidence = 0.72
  ) => {
    signals.push({
      type,
      source,
      summary,
      evidence,
      detectedFrom: {
        snippet: input.slice(0, 400),
        matchType: type,
        source
      },
      confidence: clampConfidence(confidence)
    });
  };

  if (/\b(todo|fixme|hack|xxx)\b/i.test(input)) {
    pushSignal(
      'temporary_workaround',
      'todo_fixme',
      'Code comment signals a temporary workaround that should not be treated as a permanent fix.',
      [{ kind: 'text', ref: 'inline-comment', reason: 'TODO, FIXME, HACK, or XXX markers were found.' }]
    );
  }

  if (
    /accepted debt|deliberate shortcut|intentional shortcut|known limitation|migration in progress|temporary workaround/i.test(
      normalized
    )
  ) {
    pushSignal(
      'accepted_debt',
      'code_comment',
      'Repository text states that the current behavior is an accepted debt or deliberate shortcut.',
      [{ kind: 'text', ref: 'inline-policy', reason: 'Accepted-debt phrasing was detected.' }],
      0.88
    );
  }

  if (/known limitation|documented limitation|intentionally limited|by design/i.test(normalized)) {
    pushSignal(
      'known_limitation',
      'manual_review',
      'Repository text declares a known limitation that should be tracked explicitly.',
      [{ kind: 'text', ref: 'policy-notes', reason: 'Known-limitation language was detected.' }],
      0.84
    );
  }

  if (/migration in progress|migrating|rollout|cutover/i.test(normalized)) {
    pushSignal(
      'migration_in_progress',
      'commit_message',
      'Repository text indicates a migration or rollout is still in progress.',
      [{ kind: 'text', ref: 'migration-note', reason: 'Migration-phase language was detected.' }],
      0.8
    );
  }

  if (/temporary workaround|short-term fix|for now|until we migrate/i.test(normalized)) {
    pushSignal(
      'temporary_workaround',
      'manual_review',
      'Repository text describes a temporary workaround that should be tracked separately from durable debt.',
      [{ kind: 'text', ref: 'workaround-note', reason: 'Temporary-workaround language was detected.' }],
      0.86
    );
  }

  return signals;
}

function dedupeRiskIntentCandidates(intents: RiskIntentCandidate[]): RiskIntentCandidate[] {
  const seen = new Set<string>();
  return intents.filter((intent) => {
    const key = [
      intent.type,
      intent.source,
      normalizeText(intent.summary).slice(0, 120)
    ].join('|');
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function addEvidenceFromSource(
  signals: RiskIntentCandidate[],
  sourcePath: string,
  kind: string,
  content: string,
  source: RiskIntentSource
) {
  const evidence = [
    { kind, ref: sourcePath, reason: `Risk intent detected while scanning ${sourcePath}.` }
  ];
  for (const signal of collectTextSignals(content)) {
    signals.push({
      ...signal,
      source: signal.source ?? source,
      evidence
    });
  }
}

export function extractRiskIntentCandidates(input: {
  repo_tree: string[];
  source_files: Array<{ path: string; preview: string; kind: string }>;
  source_code_samples: Record<string, string>;
  agent_prompts?: Record<string, string>;
  existing_issues?: Array<{ title: string; labels?: string[]; body?: string | null }>;
  metadata?: Record<string, unknown>;
}): RiskIntentCandidate[] {
  const signals: RiskIntentCandidate[] = [];

  for (const sourceFile of input.source_files ?? []) {
    addEvidenceFromSource(signals, sourceFile.path, sourceFile.kind, sourceFile.preview, 'manual_review');
  }

  for (const [path, content] of Object.entries(input.source_code_samples ?? {})) {
    addEvidenceFromSource(signals, path, 'code', content, 'todo_fixme');
  }

  for (const [path, prompt] of Object.entries(input.agent_prompts ?? {})) {
    addEvidenceFromSource(signals, path, 'prompt', prompt, 'manual_review');
  }

  for (const issue of input.existing_issues ?? []) {
    const labels = asStringList(issue.labels);
    const labelText = labels.join(' ');
    const title = issue.title ?? '';
    const combined = `${title} ${labelText} ${issue.body ?? ''}`.trim();
    if (!combined) continue;

    if (/debt|workaround|limitation|migration|shortcut/i.test(combined)) {
      signals.push({
        type: /migration/i.test(combined)
          ? 'migration_in_progress'
          : /limitation/i.test(combined)
            ? 'known_limitation'
            : /workaround/i.test(combined)
              ? 'temporary_workaround'
              : 'accepted_debt',
        source: 'issue_label',
        summary: `Existing issue "${title}" signals tracked risk: ${labels.join(', ') || 'issue text only'}.`,
        evidence: [
          {
            kind: 'issue',
            ref: title || 'existing-issue',
            reason: 'The issue title or labels indicate an accepted or ongoing risk surface.'
          }
        ],
        detectedFrom: {
          title,
          labels,
          source: 'issue_label'
        },
        confidence: 0.79
      });
    }
  }

  if (input.metadata && isPlainObject(input.metadata)) {
    const metadataText = Object.values(input.metadata)
      .map((entry) => (typeof entry === 'string' ? entry : JSON.stringify(entry)))
      .join('\n');
    for (const intent of collectTextSignals(metadataText)) {
      signals.push(intent);
    }
  }

  return dedupeRiskIntentCandidates(signals);
}

export async function ensureDefaultPolicyPack(input: {
  organizationId: string;
  createdById?: string | null;
}) {
  const existing = await prisma.policyPack.findFirst({
    where: {
      organizationId: input.organizationId,
      status: 'active',
      name: 'premortem-default'
    },
    orderBy: { updatedAt: 'desc' }
  });

  if (existing) {
    return existing;
  }

  const organization = await prisma.organization.findUniqueOrThrow({
    where: { id: input.organizationId },
    select: { plan: true, name: true }
  });

  return prisma.policyPack.create({
    data: {
      organizationId: input.organizationId,
      createdById: input.createdById ?? undefined,
      name: 'premortem-default',
      description: `Default policy pack for ${organization.name}`,
      scope: 'organization',
      status: 'active',
      version: 1,
      rules: summarizePolicyRules(String(organization.plan)),
      decisionCriteria: summarizePolicyCriteria(String(organization.plan)),
      metadata: {
        source: 'system-default',
        organizationPlan: organization.plan
      }
    }
  });
}

export async function persistRiskIntents(input: {
  organizationId: string;
  projectId?: string | null;
  auditRunId?: string | null;
  issueCandidateId?: string | null;
  profileId?: string | null;
  intents: RiskIntentCandidate[];
}) {
  const created: Array<{ id: string; type: RiskIntentType; source: RiskIntentSource }> = [];

  for (const intent of input.intents) {
    const row = await prisma.riskIntent.create({
      data: {
        organizationId: input.organizationId,
        projectId: input.projectId ?? undefined,
        auditRunId: input.auditRunId ?? undefined,
        issueCandidateId: input.issueCandidateId ?? undefined,
        profileId: input.profileId ?? undefined,
        type: intent.type,
        source: intent.source,
        summary: intent.summary,
        evidence: intent.evidence,
        detectedFrom: intent.detectedFrom,
        confidence: intent.confidence,
        expiresAt: intent.expiresAt ?? undefined
      },
      select: {
        id: true,
        type: true,
        source: true
      }
    });
    created.push(row);
  }

  return created;
}

export function classifyPolicyDecision(input: {
  issue: {
    title: string;
    category: string;
    severity: string;
    predictedFailureSummary: string;
    whyItMatters: string;
    affectedAssets: string[];
    sourceAgents?: string[];
    sourceFindings?: string[];
  };
  riskIntents: Array<{
    id: string;
    type: RiskIntentType;
    source: RiskIntentSource;
    summary: string;
    status?: RiskIntentStatus;
  }>;
  policyPack?: PolicyPackSnapshot | null;
}) {
  const searchable = normalizeText(
    [
      input.issue.title,
      input.issue.category,
      input.issue.predictedFailureSummary,
      input.issue.whyItMatters,
      ...(input.issue.affectedAssets ?? []),
      ...(input.issue.sourceAgents ?? []),
      ...(input.issue.sourceFindings ?? [])
    ].join(' ')
  );

  const matchingRiskIntents = input.riskIntents.filter((intent) => {
    if (intent.status && intent.status !== 'active') return false;
    const summary = normalizeText(intent.summary);
    return summary.length > 0 && (searchable.includes(summary.slice(0, 24)) || searchable.includes(summary.split(' ').slice(0, 4).join(' ')));
  });

  const matchingTypes = new Set(matchingRiskIntents.map((intent) => intent.type));
  const severity = input.issue.severity.toLowerCase();
  const highSeverity = severity === 'critical' || severity === 'high';

  let outcome: PolicyDecisionOutcome = 'show_now';
  let rationale = 'No tracked policy exception matched, so the issue should surface now.';

  if (matchingTypes.has('known_limitation') && !highSeverity) {
    outcome = 'suppress';
    rationale = 'The issue matches a known limitation and is not high severity, so it should be suppressed from the primary queue.';
  } else if (
    matchingTypes.has('accepted_debt') ||
    matchingTypes.has('deliberate_shortcut') ||
    matchingTypes.has('temporary_workaround') ||
    matchingTypes.has('migration_in_progress')
  ) {
    outcome = highSeverity ? 'show_now' : 'batch_later';
    rationale =
      'The issue overlaps with tracked debt or a temporary workaround, so it should be grouped instead of treated as a fresh uncategorized risk.';
  } else if (highSeverity) {
    outcome = 'show_now';
    rationale = 'Critical or high severity issues always remain visible.';
  }

  const policyScore =
    highSeverity ? 0.95 : matchingRiskIntents.length > 0 ? 0.72 : 0.5;

  return {
    outcome,
    rationale,
    score: policyScore,
    details: {
      policyPack: input.policyPack
        ? {
            id: input.policyPack.id,
            name: input.policyPack.name,
            scope: input.policyPack.scope,
            status: input.policyPack.status
          }
        : null,
      matchingRiskIntentIds: matchingRiskIntents.map((intent) => intent.id),
      matchingRiskIntentTypes: [...matchingTypes],
      issueSeverity: input.issue.severity,
      policyQueueAction: outcome
    }
  };
}

export async function recordPolicyDecision(input: {
  organizationId: string;
  projectId?: string | null;
  auditRunId?: string | null;
  issueCandidateId?: string | null;
  riskIntentId?: string | null;
  policyPackId?: string | null;
  createdById?: string | null;
  outcome: PolicyDecisionOutcome;
  rationale: string;
  details?: Prisma.InputJsonValue;
  score?: number | null;
}) {
  return prisma.policyDecision.create({
    data: {
      organizationId: input.organizationId,
      projectId: input.projectId ?? undefined,
      auditRunId: input.auditRunId ?? undefined,
      issueCandidateId: input.issueCandidateId ?? undefined,
      riskIntentId: input.riskIntentId ?? undefined,
      policyPackId: input.policyPackId ?? undefined,
      createdById: input.createdById ?? undefined,
      outcome: input.outcome,
      rationale: input.rationale,
      details: input.details ?? {},
      score: input.score ?? undefined
    }
  });
}

export async function recordFixVerification(input: {
  organizationId: string;
  projectId: string;
  issueCandidateId: string;
  publishedIssueId: string;
  sourceAuditRunId?: string | null;
  closingAuditRunId?: string | null;
  sourceGraphSnapshotId?: string | null;
  closingGraphSnapshotId?: string | null;
  createdById?: string | null;
  status: FixVerificationStatus;
  summary: string;
  evidence?: Prisma.InputJsonValue;
  observedChanges?: Prisma.InputJsonValue;
  verifiedAt?: Date | null;
}) {
  return prisma.fixVerification.create({
    data: {
      organizationId: input.organizationId,
      projectId: input.projectId,
      issueCandidateId: input.issueCandidateId,
      publishedIssueId: input.publishedIssueId,
      sourceAuditRunId: input.sourceAuditRunId ?? undefined,
      closingAuditRunId: input.closingAuditRunId ?? undefined,
      sourceGraphSnapshotId: input.sourceGraphSnapshotId ?? undefined,
      closingGraphSnapshotId: input.closingGraphSnapshotId ?? undefined,
      verifiedById: input.createdById ?? undefined,
      status: input.status,
      summary: input.summary,
      evidence: input.evidence ?? [],
      observedChanges: input.observedChanges ?? {},
      verifiedAt: input.verifiedAt ?? (input.status === 'resolved' ? new Date() : undefined)
    }
  });
}

export async function recordEvalRun(input: {
  organizationId: string;
  projectId?: string | null;
  auditRunId?: string | null;
  createdById?: string | null;
  provider: EvalProvider;
  name: string;
  status?: EvalRunStatus;
  summary?: string | null;
  metrics?: Prisma.InputJsonValue;
  inputPayload?: Prisma.InputJsonValue;
  outputPayload?: Prisma.InputJsonValue;
  errorMessage?: string | null;
  startedAt?: Date | null;
  completedAt?: Date | null;
  assertions?: Array<{
    assertionKey: string;
    status: string;
    score?: number | null;
    details?: Prisma.InputJsonValue;
  }>;
}) {
  return prisma.$transaction(async (tx) => {
    const evalRun = await tx.evalRun.create({
      data: {
        organizationId: input.organizationId,
        projectId: input.projectId ?? undefined,
        auditRunId: input.auditRunId ?? undefined,
        createdById: input.createdById ?? undefined,
        provider: input.provider,
        status: input.status ?? 'completed',
        name: input.name,
        summary: input.summary ?? null,
        metrics: input.metrics ?? {},
        input: input.inputPayload ?? {},
        output: input.outputPayload ?? {},
        errorMessage: input.errorMessage ?? null,
        startedAt: input.startedAt ?? null,
        completedAt: input.completedAt ?? new Date()
      }
    });

    if (input.assertions && input.assertions.length > 0) {
      await tx.evalAssertionResult.createMany({
        data: input.assertions.map((assertion) => ({
          evalRunId: evalRun.id,
          assertionKey: assertion.assertionKey,
          status: assertion.status,
          score: assertion.score ?? undefined,
          details: assertion.details ?? {}
        }))
      });
    }

    return evalRun;
  });
}

export async function linkPublishedIssueLineage(input: {
  publishedIssueId: string;
  priorPublishedIssueId?: string | null;
  relationType: PublishedIssueLinkRelationType;
}) {
  return prisma.publishedIssueLink.create({
    data: {
      publishedIssueId: input.publishedIssueId,
      priorPublishedIssueId: input.priorPublishedIssueId ?? undefined,
      relationType: input.relationType
    }
  });
}
