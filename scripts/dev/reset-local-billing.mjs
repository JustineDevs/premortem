#!/usr/bin/env node
/**
 * Reset every workspace to the Free tier for billing upgrade demos.
 * Keeps Stripe customer IDs so test-mode Checkout can still be exercised later.
 */

import { loadPremortemLocalEnv } from '../load-local-env.mjs';
import { applySupabaseDatabaseEnv } from '../../packages/db/supabase-database-url.mjs';

loadPremortemLocalEnv();
applySupabaseDatabaseEnv(process.env);

const { prisma, auditQuotaForPlan } = await import('@premortem/db');

const freeQuota = auditQuotaForPlan('free');

const organizations = await prisma.organization.updateMany({
  data: { plan: 'free' }
});

const billingAccounts = await prisma.organizationBillingAccount.updateMany({
  data: {
    plan: 'free',
    auditQuotaMonthly: freeQuota,
    billingStatus: 'active'
  }
});

const sample = await prisma.organization.findMany({
  select: {
    slug: true,
    plan: true,
    billingAccount: { select: { plan: true, auditQuotaMonthly: true } }
  },
  take: 8
});

console.log('Billing reset complete (all workspaces → Free tier).');
console.log(`  organizations updated: ${organizations.count}`);
console.log(`  billing accounts updated: ${billingAccounts.count}`);
console.log(`  free audit quota: ${freeQuota}/month`);
console.log('  sample:');
for (const org of sample) {
  console.log(
    `    ${org.slug}: org=${org.plan}, billing=${org.billingAccount?.plan ?? 'none'}`
  );
}
console.log('\nNext: open /app → Settings → Billing and upgrade to Pro or Team.');

await prisma.$disconnect();
