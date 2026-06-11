#!/usr/bin/env node
import { loadSmokeEnv } from './load-smoke-env.mjs';

loadSmokeEnv();

const { prisma, canCreateGitLabIssues, resolveGitLabExternalProjectIdFromEnv } = await import('@premortem/db');

const externalProjectId =
  process.env.GITLAB_EXTERNAL_PROJECT_ID?.trim() ??
  resolveGitLabExternalProjectIdFromEnv() ??
  'jstn-studio/meta-architect';
const probeProjects = [
  externalProjectId,
  'jstn-studio/premortem',
  'JustineDevs/premortem'
].filter((value, index, array) => array.indexOf(value) === index);
const baseUrl = (process.env.GITLAB_BASE_URL ?? 'https://gitlab.com').replace(/\/$/, '');

function decode(token) {
  return token.startsWith('plain:') ? token.slice('plain:'.length) : token;
}

console.log('probeProjects', probeProjects.join(', '));

const connections = await prisma.providerConnection.findMany({
  where: { provider: 'gitlab', status: 'active', encryptedAccessToken: { not: null } },
  orderBy: { updatedAt: 'desc' },
  take: 12
});

for (const projectId of probeProjects) {
  console.log('\n== project', projectId, '==');
  for (const label of ['GITLAB_SMOKE_PUBLISH_TOKEN', 'GITLAB_TOKEN']) {
    const token = process.env[label]?.trim();
    if (!token) continue;
    try {
      const ok = await canCreateGitLabIssues({ baseUrl, token, externalProjectId: projectId });
      console.log(label, ok ? 'OK' : 'FAIL');
    } catch (error) {
      console.log(label, 'ERR', error instanceof Error ? error.message : error);
    }
  }

  for (const connection of connections) {
    const token = decode(connection.encryptedAccessToken ?? '');
    try {
      const ok = await canCreateGitLabIssues({ baseUrl, token, externalProjectId: projectId });
      console.log('connection', connection.externalAccountName, ok ? 'OK' : 'FAIL');
      if (!ok) {
        const { verifyGitLabIssueCreateAccess } = await import('@premortem/db');
        try {
          await verifyGitLabIssueCreateAccess({ baseUrl, token, externalProjectId: projectId });
        } catch (error) {
          console.log('  reason', error instanceof Error ? error.message.slice(0, 240) : error);
        }
      }
    } catch (error) {
      console.log('connection', connection.externalAccountName, 'ERR', error instanceof Error ? error.message.slice(0, 240) : error);
    }
  }
}

await prisma.$disconnect();
