#!/usr/bin/env node
/**
 * Drop audit artifacts from all workspaces and re-bind the smoke fixture project
 * when PREMORTEM_AUTH_DISABLED=1. Real-user workspaces are untouched except audit rows.
 */

import { applyPremortemLocalEnvFileOverrides, loadPremortemLocalEnv } from '../load-local-env.mjs';
import { applySupabaseDatabaseEnv } from '../../packages/db/supabase-database-url.mjs';

const ROOT = loadPremortemLocalEnv();
applyPremortemLocalEnvFileOverrides(['GITLAB_EXTERNAL_PROJECT_ID'], ROOT);
applySupabaseDatabaseEnv(process.env);

const { shouldSeedLocalDevFixture } = await import('@premortem/domain');
const { prisma, ensureLocalDevelopmentFixture } = await import('@premortem/db');

const auditRuns = await prisma.auditRun.deleteMany({});
const activity = await prisma.activityEvent.deleteMany({});
const usage = await prisma.usageEvent.deleteMany({});
const notifications = await prisma.notification.deleteMany({});

if (shouldSeedLocalDevFixture()) {
  await ensureLocalDevelopmentFixture();
}

const externalProjectId =
  process.env.GITLAB_EXTERNAL_PROJECT_ID?.trim() ?? 'jstn-studio/meta-architect';

console.log('Local audit data reset complete.');
console.log(`  repo: ${ROOT}`);
console.log(`  removed audit runs: ${auditRuns.count}`);
console.log(`  removed activity events: ${activity.count}`);
console.log(`  removed usage events: ${usage.count}`);
console.log(`  removed notifications: ${notifications.count}`);
if (shouldSeedLocalDevFixture()) {
  console.log(`  smoke fixture rebound to ${externalProjectId}`);
} else {
  console.log('  real-user mode: sign in and connect GitLab to run audits');
}
console.log('\nNext: sign in at /login, connect GitLab, then run an audit from /app.');

await prisma.$disconnect();
