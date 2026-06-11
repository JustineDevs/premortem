import { randomUUID } from 'node:crypto';

import { PLAN_LIMITS } from './entitlements';
import { resolveGitLabExternalProjectIdFromEnv } from './gitlab-url';
import { prisma } from './client';
import {
  enableDiscoveredRepositories,
  listDiscoveredRepositories
} from './repository-discovery';
import { createPersonalWorkspaceForProfile, upsertProviderConnectionFromOAuth } from './workspace';

export interface StrangerSmokeWorkspace {
  profileId: string;
  organizationId: string;
  projectId: string;
  connectionId: string;
  externalProjectId: string;
  email: string;
}

async function resolveGitLabProfile(baseUrl: string, token: string) {
  const response = await fetch(`${baseUrl.replace(/\/$/, '')}/api/v4/user`, {
    headers: { 'PRIVATE-TOKEN': token }
  });
  if (!response.ok) {
    throw new Error(`GitLab token validation failed (${response.status}).`);
  }
  return (await response.json()) as { id: number; username: string; name?: string };
}

/** Simulates stranger onboarding: personal workspace + OAuth token + enabled repo (smoke/CI only). */
export async function provisionStrangerSmokeWorkspace(input: {
  gitlabAccessToken: string;
  externalProjectId?: string;
}): Promise<StrangerSmokeWorkspace> {
  const token = input.gitlabAccessToken.trim();
  if (!token) {
    throw new Error('provisionStrangerSmokeWorkspace requires gitlabAccessToken.');
  }

  const baseUrl = (process.env.GITLAB_BASE_URL ?? 'https://gitlab.com').replace(/\/$/, '');
  const profile = await resolveGitLabProfile(baseUrl, token);
  const profileId = randomUUID();
  const email = `smoke-stranger-${Date.now()}@premortem.dev`;
  const username = `smoke_${profile.username}_${Date.now().toString(36)}`;

  const organizationId = await createPersonalWorkspaceForProfile(profileId, {
    email,
    fullName: profile.name ?? 'Smoke Stranger',
    username
  });

  const connection = await upsertProviderConnectionFromOAuth({
    organizationId,
    createdById: profileId,
    provider: 'gitlab',
    externalAccountId: String(profile.id),
    externalAccountName: profile.username,
    accessToken: token,
    accessScope: {
      summary: 'read_user, api, read_repository, write_repository',
      smoke: true
    }
  });

  const targetExternalProjectId =
    input.externalProjectId?.trim() ||
    resolveGitLabExternalProjectIdFromEnv() ||
    '';

  const discovered = await listDiscoveredRepositories({
    organizationId,
    connectionId: connection.id
  });

  const registered = await prisma.project.findMany({
    where: { provider: 'gitlab' },
    select: { externalProjectId: true }
  });
  const takenExternalIds = new Set(registered.map((row) => row.externalProjectId));

  let externalProjectId = targetExternalProjectId;
  if (!externalProjectId || takenExternalIds.has(externalProjectId)) {
    const candidate =
      discovered.repositories.find(
        (row) =>
          !takenExternalIds.has(row.externalProjectId) &&
          row.canWriteIssues &&
          (row.defaultBranch === 'main' || row.defaultBranch === 'master')
      ) ??
      discovered.repositories.find(
        (row) =>
          !takenExternalIds.has(row.externalProjectId) &&
          (row.defaultBranch === 'main' || row.defaultBranch === 'master')
      );
    if (!candidate?.externalProjectId) {
      throw new Error(
        'No unregistered GitLab repository available for stranger smoke. Use a repo not already linked to another workspace, or purge stale project rows.'
      );
    }
    externalProjectId = candidate.externalProjectId;
  }

  const enabled = await enableDiscoveredRepositories({
    organizationId,
    connectionId: connection.id,
    externalProjectIds: [externalProjectId],
    createdById: profileId
  });

  const project = enabled.enabled[0];
  if (!project?.id) {
    throw new Error(`Failed to enable GitLab repository ${externalProjectId} for stranger smoke.`);
  }

  await prisma.organizationBillingAccount.upsert({
    where: { organizationId },
    update: { plan: 'pro', auditQuotaMonthly: PLAN_LIMITS.pro.auditsPerMonth },
    create: {
      organizationId,
      plan: 'pro',
      auditQuotaMonthly: PLAN_LIMITS.pro.auditsPerMonth,
      auditsUsedMonth: 0
    }
  });
  await prisma.organization.update({
    where: { id: organizationId },
    data: { plan: 'pro' }
  });

  return {
    profileId,
    organizationId,
    projectId: project.id,
    connectionId: connection.id,
    externalProjectId,
    email
  };
}

export async function cleanupStrangerSmokeWorkspace(workspace: StrangerSmokeWorkspace) {
  await prisma.auditRun.deleteMany({ where: { organizationId: workspace.organizationId } });
  await prisma.project.deleteMany({ where: { organizationId: workspace.organizationId } });
  await prisma.providerConnection.deleteMany({ where: { organizationId: workspace.organizationId } });
  await prisma.organizationMembership.deleteMany({ where: { organizationId: workspace.organizationId } });
  await prisma.organizationBillingAccount.deleteMany({
    where: { organizationId: workspace.organizationId }
  });
  await prisma.organization.deleteMany({ where: { id: workspace.organizationId } });
  await prisma.profile.deleteMany({ where: { id: workspace.profileId } });
}
