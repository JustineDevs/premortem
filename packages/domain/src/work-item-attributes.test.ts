import assert from 'node:assert/strict';
import test from 'node:test';

import { buildWorkItemAttributes, DEFAULT_WORK_ITEM_ATTRIBUTE_CONFIG } from './work-item-attributes';

test('work item attributes footer collapses metadata and preserves reviewer-approved note', () => {
  const output = buildWorkItemAttributes(DEFAULT_WORK_ITEM_ATTRIBUTE_CONFIG, {
    issueCandidateId: 'issue-1',
    auditRunId: 'audit-1',
    title: 'Test issue',
    category: 'security',
    severity: 'high',
    priority: 'p1',
    confidence: 0.91,
    reviewerStatus: 'approved',
    sourceAgents: ['agent-a'],
    projectLabelsTemplate: ['team::platform']
  });

  assert.ok(output.metadataFooter.includes('<details>'));
  assert.ok(output.metadataFooter.includes('Premortem work item attributes and scheduling'));
  assert.ok(output.metadataFooter.includes('reviewer-approved work item metadata'));
  assert.ok(output.metadataFooter.includes('Premortem work item attributes'));
  assert.ok(output.labels.includes('team::platform'));
  assert.ok(output.labels.includes('premortem/severity/high'));
  assert.ok(output.labels.includes('premortem/review/approved'));
});
