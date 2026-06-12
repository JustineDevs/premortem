#!/usr/bin/env node
/**
 * Move smoke-fixture projects, audits, and findings into a real Supabase user's workspace.
 * Use when configured-mode dev has audit data under LOCAL_DEV_FIXTURE but the signed-in user sees an empty console.
 *
 * PREMORTEM_REASSIGN_TARGET_EMAIL=you@example.com pnpm run db:reassign-smoke
 */

import { LOCAL_DEV_FIXTURE } from '@premortem/domain';
import { applyPremortemLocalEnvFileOverrides, loadPremortemLocalEnv } from '../load-local-env.mjs';
import { applySupabaseDatabaseEnv } from '../../packages/db/supabase-database-url.mjs';

const ROOT = loadPremortemLocalEnv();
applyPremortemLocalEnvFileOverrides([], ROOT);
applySupabaseDatabaseEnv(process.env);

const { prisma } = await import('@premortem/db');

const targetEmail =
  process.env.PREMORTEM_REASSIGN_TARGET_EMAIL?.trim() ||
  process.env.PREMORTEM_DEMO_USER_EMAIL?.trim() ||
  'tradergofficial@gmail.com';

const sourceOrgId = LOCAL_DEV_FIXTURE.organizationId;

const profile = await prisma.profile.findFirst({
  where: { email: { equals: targetEmail, mode: 'insensitive' } }
});

if (!profile) {
  console.error(`No profile found for ${targetEmail}. Sign in once at /login, then rerun.`);
  process.exit(1);
}

const membership = await prisma.organizationMembership.findFirst({
  where: { userId: profile.id },
  include: { organization: true },
  orderBy: { createdAt: 'asc' }
});

if (!membership) {
  console.error(`Profile ${targetEmail} has no organization membership.`);
  process.exit(1);
}

const targetOrgId = membership.organizationId;

if (targetOrgId === sourceOrgId) {
  console.log('Target user already owns the smoke fixture organization. Nothing to move.');
  await prisma.$disconnect();
  process.exit(0);
}

const smokeProjects = await prisma.project.findMany({
  where: { organizationId: sourceOrgId }
});

if (smokeProjects.length === 0) {
  console.log('No projects under smoke fixture org. Run smoke:audit-flow or audit:local first.');
  await prisma.$disconnect();
  process.exit(0);
}

const userGitLab = await prisma.providerConnection.findFirst({
  where: { organizationId: targetOrgId, provider: 'gitlab', status: 'active' },
  orderBy: { updatedAt: 'desc' }
});

const projectIds = smokeProjects.map((project) => project.id);

const counts = await prisma.$transaction(async (tx) => {
  for (const project of smokeProjects) {
    await tx.project.update({
      where: { id: project.id },
      data: {
        organizationId: targetOrgId,
        connectionId: userGitLab?.id ?? project.connectionId,
        createdById: profile.id
      }
    });

    await tx.projectMembership.upsert({
      where: {
        projectId_userId: {
          projectId: project.id,
          userId: profile.id
        }
      },
      create: {
        projectId: project.id,
        userId: profile.id,
        role: 'owner'
      },
      update: { role: 'owner' }
    });
  }

  const auditRuns = await tx.auditRun.updateMany({
    where: { projectId: { in: projectIds } },
    data: { organizationId: targetOrgId, triggeredById: profile.id }
  });

  const findings = await tx.finding.updateMany({
    where: { projectId: { in: projectIds } },
    data: { organizationId: targetOrgId }
  });

  const graphSnapshots = await tx.graphSnapshot.updateMany({
    where: { projectId: { in: projectIds } },
    data: { organizationId: targetOrgId }
  });

  const dedupeClusters = await tx.dedupeCluster.updateMany({
    where: { projectId: { in: projectIds } },
    data: { organizationId: targetOrgId }
  });

  const issueCandidates = await tx.issueCandidate.updateMany({
    where: { projectId: { in: projectIds } },
    data: { organizationId: targetOrgId }
  });

  const rejectedArtifacts = await tx.rejectedIssueCandidateArtifact.updateMany({
    where: { projectId: { in: projectIds } },
    data: { organizationId: targetOrgId }
  });

  const publishedIssues = await tx.publishedIssue.updateMany({
    where: { projectId: { in: projectIds } },
    data: { organizationId: targetOrgId }
  });

  const activityEvents = await tx.activityEvent.updateMany({
    where: { projectId: { in: projectIds } },
    data: { organizationId: targetOrgId }
  });

  const usageEvents = await tx.usageEvent.updateMany({
    where: { projectId: { in: projectIds } },
    data: { organizationId: targetOrgId }
  });

  const notifications = await tx.notification.updateMany({
    where: { projectId: { in: projectIds } },
    data: { organizationId: targetOrgId }
  });

  return {
    projects: smokeProjects.length,
    auditRuns: auditRuns.count,
    findings: findings.count,
    graphSnapshots: graphSnapshots.count,
    dedupeClusters: dedupeClusters.count,
    issueCandidates: issueCandidates.count,
    rejectedArtifacts: rejectedArtifacts.count,
    publishedIssues: publishedIssues.count,
    activityEvents: activityEvents.count,
    usageEvents: usageEvents.count,
    notifications: notifications.count
  };
});

console.log('Smoke workspace reassignment complete.');
console.log(`  target: ${targetEmail}`);
console.log(`  workspace: ${membership.organization.name} (${targetOrgId})`);
console.log(`  gitlab connection: ${userGitLab ? userGitLab.externalAccountName : 'none (kept smoke connection on project)'}`);
console.log(JSON.stringify(counts, null, 2));
console.log('\nRefresh /app to load projects and audit history in your workspace.');

await prisma.$disconnect();
