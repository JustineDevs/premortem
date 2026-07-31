import test from 'node:test';
import assert from 'node:assert/strict';

import { evaluateSynthesizedIssueGroundingGate } from './gate';

test('evaluates synthesized issues and rejects ungrounded evidence', () => {
  const result = evaluateSynthesizedIssueGroundingGate([
    {
      issue: {
        title: 'Grounded finding',
        category: 'release_safety',
        severity: 'high',
        evidence: []
      } as never,
      groundingErrors: []
    },
    {
      issue: {
        title: 'Hallucinated file path',
        category: 'release_safety',
        severity: 'medium',
        evidence: []
      } as never,
      groundingErrors: ['evidence ref file path missing from repo_tree: src/missing.ts:42']
    }
  ]);

  assert.equal(result.metrics.issueCount, 2);
  assert.equal(result.metrics.passedCount, 1);
  assert.equal(result.metrics.rejectedCount, 1);
  assert.equal(result.metrics.passRate, 0.5);
  assert.equal(result.passedIssues[0]?.title, 'Grounded finding');
  assert.equal(result.rejectedIssues[0]?.issue.title, 'Hallucinated file path');
  assert.equal(result.assertions[0]?.assertionKey, 'synthesized_issue_grounding_gate');
  assert.equal(result.assertions[0]?.status, 'fail');
});
