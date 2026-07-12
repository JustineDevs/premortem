import type { Prisma } from '@prisma/client';

import { readWorkspaceSkillState, installWorkspaceSkill, writeWorkspaceSkillState, type WorkspaceSkillState } from '@premortem/skills';

import { prisma } from './client';
import { invalidateWorkspaceBundleCache } from './workspace';

function asObject(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return {};
  }
  return value as Record<string, unknown>;
}

async function updateOrganizationSkillMetadata(
  organizationId: string,
  skillState: WorkspaceSkillState
) {
  const organization = await prisma.organization.findUniqueOrThrow({
    where: { id: organizationId },
    select: { metadata: true }
  });
  const metadata = { ...asObject(organization.metadata), skills: writeWorkspaceSkillState(skillState) };
  const updated = await prisma.organization.update({
    where: { id: organizationId },
    data: { metadata: metadata as unknown as Prisma.JsonObject }
  });
  invalidateWorkspaceBundleCache(organizationId);
  return updated;
}

export async function saveWorkspaceSkillState(input: {
  organizationId: string;
  skillState: WorkspaceSkillState;
}) {
  await updateOrganizationSkillMetadata(input.organizationId, input.skillState);
  return input.skillState;
}

export async function installWorkspaceSkillDraft(input: {
  organizationId: string;
  skillId: string;
}) {
  const organization = await prisma.organization.findUniqueOrThrow({
    where: { id: input.organizationId },
    select: { metadata: true }
  });
  const current = readWorkspaceSkillState(organization.metadata);
  const next = installWorkspaceSkill(current, input.skillId);

  const knownSkill = current.drafts.find((draft) => draft.id === input.skillId);
  if (!knownSkill) {
    throw new Error(`Unknown skill draft: ${input.skillId}`);
  }

  await updateOrganizationSkillMetadata(input.organizationId, next);
  return {
    installedSkillId: input.skillId,
    skillState: next,
    draft: knownSkill
  };
}

export async function getWorkspaceSkillState(organizationId: string) {
  const organization = await prisma.organization.findUniqueOrThrow({
    where: { id: organizationId },
    select: { metadata: true }
  });
  return readWorkspaceSkillState(organization.metadata);
}
