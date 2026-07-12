import assert from 'node:assert/strict';
import test from 'node:test';

import { renderPublishedIssueBodyMarkdown } from './issue-body';

test('published issue body includes snippet-shaped recommended code DNA', () => {
  const output = renderPublishedIssueBodyMarkdown(
    {
      title: 'Fix audit checkpoint race',
      category: 'audit-lifecycle',
      severity: 'high',
      confidence: 0.92,
      predictedFailureSummary: 'Concurrent checkpoint writes overwrite each other.',
      whyItMatters: 'Two agents can save conflicting state.',
      triggerConditions: ['Parallel agents finish at the same time.'],
      evidence: [
        {
          kind: 'file',
          ref: 'packages/db/src/audit-lifecycle.ts:126-163',
          reason: 'saveAuditCheckpoint reads, merges, then rewrites summary.',
          codeSnippet: [
            'const auditRun = await prisma.auditRun.findUnique({',
            '  where: { id: auditRunId },',
            '  select: { summary: true }',
            '});'
          ].join('\n')
        }
      ],
      recommendedActionSummary: 'Use atomic JSON mutation for checkpoint writes.',
      implementationSteps: ['Replace read-modify-write with jsonb_set or optimistic lock.'],
      doneCriteria: ['Checkpoint writes no longer clobber concurrent updates.'],
      affectedAssets: ['packages/db/src/audit-lifecycle.ts'],
      sourceAgents: ['audit_memory_agent'],
      sourceFindings: ['finding-123']
    },
    {
      issueCandidateId: 'issue-123',
      auditRunId: 'audit-456',
      projectPath: 'packages/db',
      branch: 'main',
      commitSha: 'abc1234',
      createdAt: '2026-07-09T00:00:00.000Z'
    }
  );

  assert.match(output, /### Recommended code DNA/);
  assert.match(output, /Evidence citation 1: packages\/db\/src\/audit-lifecycle\.ts:126-163/);
  assert.match(output, /export function applyRecommendedChange\(\) \{/);
  assert.match(output, /Preserve surrounding behavior unless a step explicitly requires it\./);
});
