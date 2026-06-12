export { LOCAL_DEV_FIXTURE } from '@premortem/domain';

import { LOCAL_DEV_FIXTURE, shouldSeedLocalDevFixture } from '@premortem/domain';
import { prisma } from './client';
import { auditQuotaForPlan } from './entitlements';
import { encodeStoredToken } from './provider-tokens';

import { resolveGitLabApiBaseUrl, resolveGitLabExternalProjectIdFromEnv } from './gitlab-url';

/** Default GitLab repo for local dev when GITLAB_EXTERNAL_PROJECT_ID is unset. */
const DEFAULT_GITLAB_EXTERNAL_PROJECT_ID = 'jstn-studio/meta-architect';

function resolveGitLabExternalProjectId(): string {
  return resolveGitLabExternalProjectIdFromEnv() ?? DEFAULT_GITLAB_EXTERNAL_PROJECT_ID;
}

function resolveGitLabRepoUrl(externalProjectId: string): string {
  const origin = resolveGitLabApiBaseUrl(process.env.GITLAB_BASE_URL);
  return `${origin}/${externalProjectId}`;
}

export async function ensureLocalDevelopmentFixture() {
  if (!shouldSeedLocalDevFixture()) {
    return;
  }

  const externalProjectId = resolveGitLabExternalProjectId();
  const repoUrl = resolveGitLabRepoUrl(externalProjectId);

  await prisma.profile.upsert({
    where: { id: LOCAL_DEV_FIXTURE.profileId },
    update: {
      email: LOCAL_DEV_FIXTURE.email,
      username: LOCAL_DEV_FIXTURE.username,
      fullName: 'Local Dev Operator'
    },
    create: {
      id: LOCAL_DEV_FIXTURE.profileId,
      email: LOCAL_DEV_FIXTURE.email,
      username: LOCAL_DEV_FIXTURE.username,
      fullName: 'Local Dev Operator'
    }
  });

  await prisma.organization.upsert({
    where: { id: LOCAL_DEV_FIXTURE.organizationId },
    update: {
      name: 'Premortem Local Dev',
      slug: LOCAL_DEV_FIXTURE.organizationSlug,
      plan: 'free',
      createdById: LOCAL_DEV_FIXTURE.profileId,
      metadata: {
        runtime: { continuousAuditEnabled: false }
      } as object
    },
    create: {
      id: LOCAL_DEV_FIXTURE.organizationId,
      name: 'Premortem Local Dev',
      slug: LOCAL_DEV_FIXTURE.organizationSlug,
      plan: 'free',
      createdById: LOCAL_DEV_FIXTURE.profileId,
      metadata: {
        runtime: { continuousAuditEnabled: false }
      } as object
    }
  });

  await prisma.organizationMembership.upsert({
    where: {
      organizationId_userId: {
        organizationId: LOCAL_DEV_FIXTURE.organizationId,
        userId: LOCAL_DEV_FIXTURE.profileId
      }
    },
    update: { role: 'owner' },
    create: {
      organizationId: LOCAL_DEV_FIXTURE.organizationId,
      userId: LOCAL_DEV_FIXTURE.profileId,
      role: 'owner'
    }
  });

  // One dev project row; externalProjectId tracks the real GitLab repo under audit.
  await prisma.project.deleteMany({
    where: {
      organizationId: LOCAL_DEV_FIXTURE.organizationId,
      id: { not: LOCAL_DEV_FIXTURE.projectId }
    }
  });

  await prisma.project.upsert({
    where: { id: LOCAL_DEV_FIXTURE.projectId },
    update: {
      organizationId: LOCAL_DEV_FIXTURE.organizationId,
      provider: 'gitlab',
      externalProjectId,
      repoUrl,
      name: externalProjectId.split('/').pop() ?? 'meta-architect',
      slug: LOCAL_DEV_FIXTURE.projectSlug,
      defaultBranch: 'main',
      createdById: LOCAL_DEV_FIXTURE.profileId
    },
    create: {
      id: LOCAL_DEV_FIXTURE.projectId,
      organizationId: LOCAL_DEV_FIXTURE.organizationId,
      provider: 'gitlab',
      externalProjectId,
      repoUrl,
      name: externalProjectId.split('/').pop() ?? 'meta-architect',
      slug: LOCAL_DEV_FIXTURE.projectSlug,
      defaultBranch: 'main',
      createdById: LOCAL_DEV_FIXTURE.profileId
    }
  });

  const gitlabAccount = externalProjectId.split('/')[0] ?? 'gitlab';

  const connection = await prisma.providerConnection.upsert({
    where: {
      organizationId_provider_externalAccountId: {
        organizationId: LOCAL_DEV_FIXTURE.organizationId,
        provider: 'gitlab',
        externalAccountId: gitlabAccount
      }
    },
    update: {
      externalAccountName: gitlabAccount,
      status: 'active',
      lastSyncedAt: new Date(),
      accessScope: { summary: 'read_user, api, read_repository, write_repository' },
      ...(process.env.GITLAB_TOKEN ? { encryptedAccessToken: encodeStoredToken(process.env.GITLAB_TOKEN) } : {})
    },
    create: {
      organizationId: LOCAL_DEV_FIXTURE.organizationId,
      provider: 'gitlab',
      externalAccountId: gitlabAccount,
      externalAccountName: gitlabAccount,
      status: 'active',
      createdById: LOCAL_DEV_FIXTURE.profileId,
      lastSyncedAt: new Date(),
      accessScope: { summary: 'read_user, api, read_repository, write_repository' },
      ...(process.env.GITLAB_TOKEN ? { encryptedAccessToken: encodeStoredToken(process.env.GITLAB_TOKEN) } : {})
    }
  });

  await prisma.project.update({
    where: { id: LOCAL_DEV_FIXTURE.projectId },
    data: {
      connectionId: connection.id,
      connectedAt: new Date(),
      settings: { autoRunOnPush: false } as object
    }
  });

  await prisma.projectSetting.upsert({
    where: { projectId: LOCAL_DEV_FIXTURE.projectId },
    update: { autoRunOnPush: false },
    create: { projectId: LOCAL_DEV_FIXTURE.projectId, autoRunOnPush: false }
  });

  await prisma.organizationBillingAccount.upsert({
    where: { organizationId: LOCAL_DEV_FIXTURE.organizationId },
    update: {
      plan: 'pro',
      auditQuotaMonthly: auditQuotaForPlan('pro'),
      auditsUsedMonth: 0,
      billingStatus: 'active'
    },
    create: {
      organizationId: LOCAL_DEV_FIXTURE.organizationId,
      plan: 'pro',
      auditQuotaMonthly: auditQuotaForPlan('pro'),
      auditsUsedMonth: 0,
      billingStatus: 'active'
    }
  });
}
