import assert from 'node:assert/strict';
import test from 'node:test';

import { projectSnapshotToConsoleAudit } from './console-projection';

test('console projection exposes snippet-shaped suggested patch code', () => {
  const snapshot = projectSnapshotToConsoleAudit(
    {
      auditRunId: 'audit-1',
      projectId: 'project-1',
      branch: 'main',
      runStatus: 'completed',
      issueCandidates: [
        {
          id: 'issue-1',
          title: 'Fix stale audit checkpoint writes',
          validationStatus: 'validated',
          reviewerStatus: 'open',
          predictedFailureSummary: 'Concurrent writes can overwrite checkpoints.',
          whyItMatters: 'Issue state can drift under concurrency.',
          triggerConditions: ['Two runs finish together.'],
          recommendedActionSummary: 'Switch to atomic update semantics.',
          implementationSteps: ['Use a single SQL update with JSON mutation.'],
          doneCriteria: ['Concurrent saves preserve both updates.'],
          affectedAssets: ['packages/db/src/audit-lifecycle.ts'],
          sourceAgents: ['audit_memory_agent'],
          sourceFindings: ['finding-1'],
          evidenceRefs: [
            {
              kind: 'file',
              ref: 'packages/db/src/audit-lifecycle.ts:126-163',
              reason: 'saveAuditCheckpoint reads summary before update.',
              codeSnippet: [
                'const auditRun = await prisma.auditRun.findUnique({',
                '  where: { id: auditRunId },',
                '  select: { summary: true }',
                '});'
              ].join('\n')
            }
          ]
        }
      ],
      findings: [],
      lineage: [],
      events: []
    },
    'Project One'
  );

  const finding = snapshot.findings[0];
  assert.ok(finding);
  assert.match(finding.suggestedPatchCode ?? '', /Recommended code DNA for Fix stale audit checkpoint writes/);
  assert.match(finding.suggestedPatchCode ?? '', /Evidence citation 1: packages\/db\/src\/audit-lifecycle\.ts:126-163/);
  assert.match(finding.suggestedPatchCode ?? '', /export function applyRecommendedChange\(\) \{/);
});
