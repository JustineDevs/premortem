import assert from 'node:assert/strict';
import test from 'node:test';

import { apiReferenceDoc, internalApiOperationsDoc, runAuditGuideDoc } from './docs-index.js';

function flattenDocText(doc: unknown) {
  return JSON.stringify(doc);
}

test('public docs do not expose the internal stop-all route', () => {
  const publicApiText = flattenDocText(apiReferenceDoc);
  const publicRunAuditText = flattenDocText(runAuditGuideDoc);

  assert.ok(!publicApiText.includes('/api/workspace/runtime/stop-all'));
  assert.ok(!publicRunAuditText.includes('/api/workspace/runtime/stop-all'));
});

test('internal API operations docs keep operator-only routes explicit', () => {
  const internalText = flattenDocText(internalApiOperationsDoc);

  assert.ok(internalText.includes('/api/workspace/runtime/stop-all'));
  assert.ok(internalText.includes('/api/webhooks/gitlab'));
  assert.ok(internalText.includes('/api/stripe/webhook'));
});
