import { renderPremortemPublishAttribution } from './branding';

export interface WorkItemAttributeConfig {
  autoApply: boolean;
  labelPrefix: string;
  includeSeverity: boolean;
  includeCategory: boolean;
  includePriority: boolean;
  includeAuditRef: boolean;
  includeConfidenceBand: boolean;
  gitlab: {
    ensureProjectLabels: boolean;
    defaultMilestoneId?: number | null;
    defaultMilestoneTitle?: string | null;
    defaultAssigneeId?: number | null;
    defaultAssigneeUsername?: string | null;
    dueDateDaysBySeverity?: Partial<Record<string, number>>;
    timeEstimateByPriority?: Partial<Record<string, string>>;
    weightBySeverity?: Partial<Record<string, number>>;
  };
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

const DEFAULT_DUE_DATE_DAYS: Record<string, number> = {
  critical: 7,
  high: 14,
  medium: 30,
  low: 45
};

const DEFAULT_TIME_ESTIMATE: Record<string, string> = {
  p1: '8h',
  p2: '4h',
  p3: '2h',
  p4: '1h'
};

const DEFAULT_WEIGHT_BY_SEVERITY: Record<string, number> = {
  critical: 9,
  high: 7,
  medium: 5,
  low: 3
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
  gitlabScheduling: {
    assigneeIds: number[];
    milestoneId?: number;
    dueDate?: string;
    timeEstimate?: string;
    weight?: number;
    assigneeUsername?: string;
    milestoneTitle?: string;
  };
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
          : DEFAULT_WORK_ITEM_ATTRIBUTE_CONFIG.gitlab.ensureProjectLabels,
      defaultMilestoneId:
        typeof gitlab.defaultMilestoneId === 'number' ? gitlab.defaultMilestoneId : null,
      defaultMilestoneTitle:
        typeof gitlab.defaultMilestoneTitle === 'string' ? gitlab.defaultMilestoneTitle : null,
      defaultAssigneeId:
        typeof gitlab.defaultAssigneeId === 'number' ? gitlab.defaultAssigneeId : null,
      defaultAssigneeUsername:
        typeof gitlab.defaultAssigneeUsername === 'string' ? gitlab.defaultAssigneeUsername : null,
      dueDateDaysBySeverity:
        gitlab.dueDateDaysBySeverity && typeof gitlab.dueDateDaysBySeverity === 'object'
          ? (gitlab.dueDateDaysBySeverity as Partial<Record<string, number>>)
          : DEFAULT_DUE_DATE_DAYS,
      timeEstimateByPriority:
        gitlab.timeEstimateByPriority && typeof gitlab.timeEstimateByPriority === 'object'
          ? (gitlab.timeEstimateByPriority as Partial<Record<string, string>>)
          : DEFAULT_TIME_ESTIMATE,
      weightBySeverity:
        gitlab.weightBySeverity && typeof gitlab.weightBySeverity === 'object'
          ? (gitlab.weightBySeverity as Partial<Record<string, number>>)
          : DEFAULT_WEIGHT_BY_SEVERITY
    },
    github: {
      ensureRepositoryLabels:
        typeof github.ensureRepositoryLabels === 'boolean'
          ? github.ensureRepositoryLabels
          : DEFAULT_WORK_ITEM_ATTRIBUTE_CONFIG.github.ensureRepositoryLabels
    }
  };
}

function formatDueDate(daysFromNow: number) {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() + daysFromNow);
  return date.toISOString().slice(0, 10);
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

  const severityKey = slugify(input.severity);
  const priorityKey = slugify(input.priority);
  const dueDays =
    config.gitlab.dueDateDaysBySeverity?.[severityKey] ??
    DEFAULT_DUE_DATE_DAYS[severityKey] ??
    30;
  const dueDate = formatDueDate(dueDays);
  const timeEstimate =
    config.gitlab.timeEstimateByPriority?.[priorityKey] ??
    DEFAULT_TIME_ESTIMATE[priorityKey] ??
    '2h';
  const weight =
    config.gitlab.weightBySeverity?.[severityKey] ?? DEFAULT_WEIGHT_BY_SEVERITY[severityKey] ?? 5;

  const gitlabScheduling = {
    assigneeIds: config.gitlab.defaultAssigneeId ? [config.gitlab.defaultAssigneeId] : [],
    ...(config.gitlab.defaultMilestoneId ? { milestoneId: config.gitlab.defaultMilestoneId } : {}),
    dueDate,
    timeEstimate,
    weight,
    ...(config.gitlab.defaultAssigneeUsername
      ? { assigneeUsername: config.gitlab.defaultAssigneeUsername }
      : {}),
    ...(config.gitlab.defaultMilestoneTitle
      ? { milestoneTitle: config.gitlab.defaultMilestoneTitle }
      : {})
  };

  metadata['premortem.due_date'] = dueDate;
  metadata['premortem.time_estimate'] = timeEstimate;
  metadata['premortem.weight'] = String(weight);
  if (config.gitlab.defaultAssigneeUsername) {
    metadata['premortem.assignee'] = config.gitlab.defaultAssigneeUsername;
  }
  if (config.gitlab.defaultMilestoneTitle) {
    metadata['premortem.milestone'] = config.gitlab.defaultMilestoneTitle;
  }

  const publishAttribution = renderPremortemPublishAttribution();

  const attributeTable = config.includeAuditRef
    ? [
        '### Premortem work item attributes',
        '',
        '| Attribute | Value |',
        '| --- | --- |',
        ...Object.entries(metadata).map(([key, value]) => `| \`${key}\` | ${value} |`)
      ]
    : [];

  const metadataFooter = ['', '---', ...attributeTable, '', publishAttribution].join('\n');

  return {
    labels: config.autoApply ? [...labels] : [prefix],
    labelDefinitions: [...labelDefinitions.values()],
    metadata,
    metadataFooter,
    gitlabScheduling
  };
}
