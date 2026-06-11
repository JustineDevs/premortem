export interface WorkItemAttributeConfig {
  autoApply: boolean;
  labelPrefix: string;
  includeSeverity: boolean;
  includeCategory: boolean;
  includePriority: boolean;
  includeAuditRef: boolean;
  includeConfidenceBand: boolean;
  gitlab: { ensureProjectLabels: boolean };
  github: { ensureRepositoryLabels: boolean };
}

export const DEFAULT_WORK_ITEM_ATTRIBUTE_CONFIG: WorkItemAttributeConfig = {
  autoApply: true,
  labelPrefix: 'premortem',
  includeSeverity: true,
  includeCategory: true,
  includePriority: true,
  includeAuditRef: true,
  includeConfidenceBand: true,
  gitlab: { ensureProjectLabels: true },
  github: { ensureRepositoryLabels: true }
};

export interface WorkItemAttributeInput {
  issueCandidateId: string;
  auditRunId: string;
  branch?: string | null;
  commitSha?: string | null;
  title: string;
  category: string;
  severity: string;
  priority: string;
  confidence: number;
  reviewerStatus: string;
  sourceAgents: string[];
  projectLabelsTemplate?: string[];
}

export interface ProviderLabelDefinition {
  name: string;
  color?: string;
  description?: string;
}

export interface ResolvedWorkItemAttributes {
  labels: string[];
  labelDefinitions: ProviderLabelDefinition[];
  metadata: Record<string, string>;
  metadataFooter: string;
}

const SEVERITY_COLORS: Record<string, string> = {
  critical: 'dc2626',
  high: 'ea580c',
  medium: '6366f1',
  low: '059669'
};

function slugify(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48);
}

function confidenceBand(confidence: number) {
  if (confidence >= 0.85) return 'high-confidence';
  if (confidence >= 0.65) return 'medium-confidence';
  return 'review-confidence';
}

export function normalizeWorkItemAttributeConfig(
  value: unknown
): WorkItemAttributeConfig {
  if (!value || typeof value !== 'object') {
    return { ...DEFAULT_WORK_ITEM_ATTRIBUTE_CONFIG };
  }
  const row = value as Record<string, unknown>;
  const gitlab =
    row.gitlab && typeof row.gitlab === 'object'
      ? (row.gitlab as Record<string, unknown>)
      : {};
  const github =
    row.github && typeof row.github === 'object'
      ? (row.github as Record<string, unknown>)
      : {};

  return {
    autoApply: typeof row.autoApply === 'boolean' ? row.autoApply : DEFAULT_WORK_ITEM_ATTRIBUTE_CONFIG.autoApply,
    labelPrefix:
      typeof row.labelPrefix === 'string' && row.labelPrefix.trim()
        ? slugify(row.labelPrefix)
        : DEFAULT_WORK_ITEM_ATTRIBUTE_CONFIG.labelPrefix,
    includeSeverity:
      typeof row.includeSeverity === 'boolean'
        ? row.includeSeverity
        : DEFAULT_WORK_ITEM_ATTRIBUTE_CONFIG.includeSeverity,
    includeCategory:
      typeof row.includeCategory === 'boolean'
        ? row.includeCategory
        : DEFAULT_WORK_ITEM_ATTRIBUTE_CONFIG.includeCategory,
    includePriority:
      typeof row.includePriority === 'boolean'
        ? row.includePriority
        : DEFAULT_WORK_ITEM_ATTRIBUTE_CONFIG.includePriority,
    includeAuditRef:
      typeof row.includeAuditRef === 'boolean'
        ? row.includeAuditRef
        : DEFAULT_WORK_ITEM_ATTRIBUTE_CONFIG.includeAuditRef,
    includeConfidenceBand:
      typeof row.includeConfidenceBand === 'boolean'
        ? row.includeConfidenceBand
        : DEFAULT_WORK_ITEM_ATTRIBUTE_CONFIG.includeConfidenceBand,
    gitlab: {
      ensureProjectLabels:
        typeof gitlab.ensureProjectLabels === 'boolean'
          ? gitlab.ensureProjectLabels
          : DEFAULT_WORK_ITEM_ATTRIBUTE_CONFIG.gitlab.ensureProjectLabels
    },
    github: {
      ensureRepositoryLabels:
        typeof github.ensureRepositoryLabels === 'boolean'
          ? github.ensureRepositoryLabels
          : DEFAULT_WORK_ITEM_ATTRIBUTE_CONFIG.github.ensureRepositoryLabels
    }
  };
}

export function buildWorkItemAttributes(
  config: WorkItemAttributeConfig,
  input: WorkItemAttributeInput
): ResolvedWorkItemAttributes {
  const prefix = slugify(config.labelPrefix) || 'premortem';
  const labels = new Set<string>([prefix, 'security-audit']);
  const labelDefinitions = new Map<string, ProviderLabelDefinition>();

  const register = (name: string, color?: string, description?: string) => {
    labels.add(name);
    if (!labelDefinitions.has(name)) {
      labelDefinitions.set(name, { name, color, description });
    }
  };

  register(prefix, '059669', 'Finding published by Premortem audit workflow');
  register('security-audit', '047857', 'Security audit work item');

  if (config.includeSeverity) {
    const severity = slugify(input.severity);
    register(`${prefix}/severity/${severity}`, SEVERITY_COLORS[severity], `Premortem severity: ${input.severity}`);
  }

  if (config.includeCategory) {
    const category = slugify(input.category);
    register(`${prefix}/category/${category}`, '334155', `Premortem category: ${input.category}`);
  }

  if (config.includePriority) {
    const priority = slugify(input.priority);
    register(`${prefix}/priority/${priority}`, '7c3aed', `Premortem priority: ${input.priority}`);
  }

  if (config.includeConfidenceBand) {
    const band = confidenceBand(input.confidence);
    register(`${prefix}/confidence/${band}`, '0f766e', `Premortem confidence band for ${input.confidence.toFixed(2)}`);
  }

  register(`${prefix}/review/${slugify(input.reviewerStatus)}`, '475569', 'Premortem reviewer gate status');

  for (const agent of input.sourceAgents.slice(0, 4)) {
    register(`${prefix}/agent/${slugify(agent)}`, '1d4ed8', `Source agent: ${agent}`);
  }

  for (const templateLabel of input.projectLabelsTemplate ?? []) {
    if (typeof templateLabel === 'string' && templateLabel.trim()) {
      register(templateLabel.trim());
    }
  }

  const metadata: Record<string, string> = {
    'premortem.issue_candidate_id': input.issueCandidateId,
    'premortem.audit_run_id': input.auditRunId,
    'premortem.severity': input.severity,
    'premortem.category': input.category,
    'premortem.priority': input.priority,
    'premortem.confidence': input.confidence.toFixed(3),
    'premortem.reviewer_status': input.reviewerStatus
  };

  if (input.branch) metadata['premortem.branch'] = input.branch;
  if (input.commitSha) metadata['premortem.commit_sha'] = input.commitSha;

  const metadataFooter = [
    '',
    '---',
    '### Premortem work item attributes',
    '',
    '| Attribute | Value |',
    '| --- | --- |',
    ...Object.entries(metadata).map(([key, value]) => `| \`${key}\` | ${value} |`),
    '',
    `_Automated by Premortem. Labels organize audit findings for triage, filtering, and reconciliation._`
  ].join('\n');

  return {
    labels: config.autoApply ? [...labels] : [prefix],
    labelDefinitions: [...labelDefinitions.values()],
    metadata,
    metadataFooter: config.includeAuditRef ? metadataFooter : ''
  };
}
