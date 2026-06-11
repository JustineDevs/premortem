import {
  buildWorkItemAttributes,
  normalizeWorkItemAttributeConfig,
  type WorkItemAttributeConfig
} from '@premortem/domain';
import { prisma } from '@premortem/db';

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((entry): entry is string => typeof entry === 'string' && entry.trim().length > 0);
}

export async function resolveWorkItemAttributeConfig(
  organizationId: string
): Promise<WorkItemAttributeConfig> {
  const organization = await prisma.organization.findUniqueOrThrow({
    where: { id: organizationId },
    select: { metadata: true }
  });
  const metadata =
    organization.metadata && typeof organization.metadata === 'object' && !Array.isArray(organization.metadata)
      ? (organization.metadata as Record<string, unknown>)
      : {};
  return normalizeWorkItemAttributeConfig(metadata.workItemAttributes);
}

export async function buildPublishWorkItemAttributes(input: {
  organizationId: string;
  projectId: string;
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
  sourceAgents: unknown;
}) {
  const [config, projectSetting] = await Promise.all([
    resolveWorkItemAttributeConfig(input.organizationId),
    prisma.projectSetting.findUnique({ where: { projectId: input.projectId } })
  ]);

  const sourceAgents = asStringArray(input.sourceAgents);
  const projectLabelsTemplate = asStringArray(projectSetting?.labelsTemplate);

  return buildWorkItemAttributes(config, {
    issueCandidateId: input.issueCandidateId,
    auditRunId: input.auditRunId,
    branch: input.branch,
    commitSha: input.commitSha,
    title: input.title,
    category: input.category,
    severity: input.severity,
    priority: input.priority,
    confidence: input.confidence,
    reviewerStatus: input.reviewerStatus,
    sourceAgents,
    projectLabelsTemplate
  });
}
