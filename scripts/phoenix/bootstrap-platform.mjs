#!/usr/bin/env node
/**
 * Bootstrap Phoenix datasets, prompts, and surface the TypeScript code evaluator path.
 *
 * Requires PHOENIX_API_KEY and PHOENIX_COLLECTOR_ENDPOINT (or PHOENIX_HOST).
 *
 * @see https://arize.com/docs/phoenix/sdk-api-reference/typescript/packages/phoenix-client/datasets
 * @see https://arize.com/docs/phoenix/sdk-api-reference/typescript/packages/phoenix-client/prompts
 * @see https://arize.com/docs/phoenix/evaluation/server-evals/code-evaluators#typescript
 */

import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

import { loadPremortemLocalEnv } from '../load-local-env.mjs';

loadPremortemLocalEnv();

import {
  PREMORTEM_PHOENIX_CODE_EVALUATOR_PATH,
  appendAuditMissionToPhoenixDataset,
  ensurePremortemAuditDataset,
  ensurePremortemAuditJudgePrompt,
  evaluatePremortemAuditMission,
  getPremortemAuditDatasetInfo,
  getPremortemAuditJudgePromptByName,
  isPhoenixClientConfigured
} from '@premortem/observability';

const repoRoot = resolve(import.meta.dirname, '../..');
const evaluatorPath = resolve(repoRoot, PREMORTEM_PHOENIX_CODE_EVALUATOR_PATH);

function pass(label) {
  console.log(`PASS ${label}`);
}

function fail(label, detail) {
  console.error(`FAIL ${label}${detail ? `: ${detail}` : ''}`);
  process.exitCode = 1;
}

const dryRun = process.argv.includes('--dry-run');

const sampleEval = evaluatePremortemAuditMission({
  output: {
    findingCount: 4,
    issueCandidateCount: 2,
    hasHumanReviewGate: true
  },
  reference: { minFindingCount: 1, minScore: 0.66 }
});

if (sampleEval.label !== 'passed' || sampleEval.score < 0.66) {
  fail('local code evaluator', JSON.stringify(sampleEval));
} else {
  pass(`local code evaluator (${sampleEval.label}, score ${sampleEval.score.toFixed(2)})`);
}

if (!existsSync(evaluatorPath)) {
  fail('Phoenix evaluator source', evaluatorPath);
} else {
  pass(`Phoenix evaluator source at ${PREMORTEM_PHOENIX_CODE_EVALUATOR_PATH}`);
}

if (!isPhoenixClientConfigured()) {
  pass('Phoenix client bootstrap skipped (set PHOENIX_API_KEY + PHOENIX_COLLECTOR_ENDPOINT)');
  console.log('\nNext steps:');
  console.log('- Paste the evaluator TypeScript into Phoenix UI (Evaluators → code evaluator).');
  console.log(`- Source: ${PREMORTEM_PHOENIX_CODE_EVALUATOR_PATH}`);
  process.exit(process.exitCode ?? 0);
}

if (dryRun) {
  pass('Phoenix API bootstrap skipped (--dry-run)');
  process.exit(process.exitCode ?? 0);
}

try {
  const { datasetId } = await ensurePremortemAuditDataset();
  pass(`dataset ${datasetId}`);

  const info = await getPremortemAuditDatasetInfo();
  pass(`dataset examples: ${info.exampleCount ?? 'unknown'}`);

  await appendAuditMissionToPhoenixDataset({
    input: {
      auditRunId: `bootstrap-${Date.now()}`,
      organizationId: 'bootstrap-org',
      projectId: null,
      repositoryId: null
    },
    output: {
      findingCount: 2,
      issueCandidateCount: 1,
      rejectedIssueCount: 0,
      hasHumanReviewGate: true,
      passed: true,
      score: 0.83
    },
    metadata: { source: 'scripts/phoenix/bootstrap-platform.mjs' }
  });
  pass('appended bootstrap audit example');

  await ensurePremortemAuditJudgePrompt(
    process.env.LLM_MODEL?.trim() || 'gemini-2.0-flash'
  );
  pass('prompt premortem-audit-llm-judge');

  const prompt = await getPremortemAuditJudgePromptByName();
  if (!prompt) {
    fail('prompt fetch', 'premortem-audit-llm-judge not found after create');
  } else {
    pass(`prompt version ${prompt.id ?? 'created'}`);
  }
} catch (error) {
  fail('Phoenix API bootstrap', error instanceof Error ? error.message : String(error));
}

console.log('\nPhoenix platform bootstrap complete.');
console.log(`Code evaluator source: ${PREMORTEM_PHOENIX_CODE_EVALUATOR_PATH}`);
console.log('Enable live sync after audits with PHOENIX_SYNC_DATASETS=1');
