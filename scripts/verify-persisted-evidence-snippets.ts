import assert from 'node:assert/strict';
import { normalizeEvidenceRefs } from '../packages/domain/src/evidence-projection.ts';
import { renderPublishedIssueBodyMarkdown } from '../packages/domain/src/issue-body.ts';
import { normalizePersistedEvidenceRefs } from '../services/orchestrator/src/evidence/persisted-evidence.ts';

const normalized = normalizePersistedEvidenceRefs([
  {
    kind: 'code',
    ref: 'apps/web/app/api/audits/run/route.ts:1',
    reason: 'Audit submit route anchors persisted history.',
    codeSnippet: 'const auditRunId = "audit-123";'
  },
  {
    kind: 'file',
    path: 'packages/db/src/workspace.ts:10',
    reason: 'Historical snapshot file path fallback should still resolve.'
  }
]);

assert.equal(normalized.length, 2, 'Expected persisted evidence refs to survive normalization.');
assert.equal(
  normalized[0]?.codeSnippet,
  'const auditRunId = "audit-123";',
  'Expected code snippets to survive persisted read-model normalization.'
);
assert.equal(
  normalized[1]?.ref,
  'packages/db/src/workspace.ts:10',
  'Expected path fallback to survive persisted read-model normalization.'
);

const domainNormalized = normalizeEvidenceRefs([
  {
    kind: 'historical',
    path: 'services/gitlab-sync/src/workers/reconcile-published-issues.ts:77-92',
    reason: 'Historical reconciliation snapshot should retain location.'
  }
]);

assert.equal(
  domainNormalized[0]?.ref,
  'services/gitlab-sync/src/workers/reconcile-published-issues.ts:77-92',
  'Expected domain evidence normalization to preserve historical path fallbacks.'
);

const body = renderPublishedIssueBodyMarkdown(
  {
    title: 'Persisted evidence snippet regression',
    category: 'traceability',
    severity: 'high',
    confidence: 0.91,
    predictedFailureSummary: 'Snippet-enriched evidence must survive the read model.',
    whyItMatters: 'If snippets drop, issue review loses the exact code context needed for remediation.',
    triggerConditions: ['Historical snapshots carry codeSnippet payloads.'],
    evidence: normalized,
    recommendedActionSummary: 'Preserve the evidence snippet through read-model projection.',
    implementationSteps: ['Keep codeSnippet on normalization.', 'Render the snippet in the published issue body.'],
    doneCriteria: ['The evidence block includes the source code snippet.'],
    affectedAssets: ['read-model'],
    sourceAgents: ['artifact-integrity'],
    sourceFindings: ['finding-1']
  },
  {
    auditRunId: 'audit-123',
    issueCandidateId: 'issue-123',
    projectPath: 'repo/path',
    branch: 'main',
    commitSha: 'abcdef1',
    createdAt: '2026-06-22T00:00:00.000Z',
    reviewerStatus: 'approved'
  }
);

assert.match(
  body,
  /const auditRunId = "audit-123";/,
  'Expected the published issue body to include the source code snippet.'
);
assert.match(
  body,
  /## Evidence vs recommendation/,
  'Expected the published issue body to include the evidence comparison section.'
);

console.log(
  JSON.stringify(
    {
      preservedCodeSnippet: normalized[0]?.codeSnippet,
      preservedPathFallback: normalized[1]?.ref,
      preservedHistoricalPathFallback: domainNormalized[0]?.ref,
      renderedBodyIncludesSnippet: body.includes('const auditRunId = "audit-123";')
    },
    null,
    2
  )
);
