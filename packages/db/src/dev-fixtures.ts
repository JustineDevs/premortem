export const LOCAL_DEV_FIXTURE = {
  profileId: '7f9458c3-1b8d-4f4d-a6e4-9f2333b3d821',
  organizationId: 'd86ad1f2-c720-4f54-8584-9e953dd527cb',
  projectId: 'f28e9bd2-5673-45d2-a97f-55a0b174e751',
  email: 'smoke-runner@premortem.local',
  username: 'premortem-smoke',
  organizationSlug: 'premortem-smoke-org',
  projectSlug: 'premortem-smoke-project'
} as const;

import { prisma } from './client';

export async function ensureLocalDevelopmentFixture() {
  await prisma.profile.upsert({
    where: { id: LOCAL_DEV_FIXTURE.profileId },
    update: {
      email: LOCAL_DEV_FIXTURE.email,
      username: LOCAL_DEV_FIXTURE.username,
      fullName: 'Premortem Smoke Runner'
    },
    create: {
      id: LOCAL_DEV_FIXTURE.profileId,
      email: LOCAL_DEV_FIXTURE.email,
      username: LOCAL_DEV_FIXTURE.username,
      fullName: 'Premortem Smoke Runner'
    }
  });

  await prisma.organization.upsert({
    where: { id: LOCAL_DEV_FIXTURE.organizationId },
    update: {
      name: 'Premortem Smoke Org',
      slug: LOCAL_DEV_FIXTURE.organizationSlug,
      createdById: LOCAL_DEV_FIXTURE.profileId
    },
    create: {
      id: LOCAL_DEV_FIXTURE.organizationId,
      name: 'Premortem Smoke Org',
      slug: LOCAL_DEV_FIXTURE.organizationSlug,
      createdById: LOCAL_DEV_FIXTURE.profileId
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

  await prisma.project.upsert({
    where: { id: LOCAL_DEV_FIXTURE.projectId },
    update: {
      organizationId: LOCAL_DEV_FIXTURE.organizationId,
      provider: 'gitlab',
      externalProjectId: 'premortem-smoke-project',
      name: 'Premortem Smoke Project',
      slug: LOCAL_DEV_FIXTURE.projectSlug,
      defaultBranch: 'main',
      createdById: LOCAL_DEV_FIXTURE.profileId
    },
    create: {
      id: LOCAL_DEV_FIXTURE.projectId,
      organizationId: LOCAL_DEV_FIXTURE.organizationId,
      provider: 'gitlab',
      externalProjectId: 'premortem-smoke-project',
      name: 'Premortem Smoke Project',
      slug: LOCAL_DEV_FIXTURE.projectSlug,
      defaultBranch: 'main',
      createdById: LOCAL_DEV_FIXTURE.profileId
    }
  });
}
