import assert from 'node:assert/strict';
import test from 'node:test';

import { mapSandboxResponseToAuditRun } from './map-sandbox-response';

test('sandbox findings include snippet-shaped recommendation dna', () => {
  const result = mapSandboxResponseToAuditRun({
    projectId: 'sandbox',
    projectName: 'Sandbox',
    overallScore: 88,
    findings: [
      {
        category: 'sql_injection',
        severity: 'high',
        predicted_failure: {
          summary: 'Unsafe string concatenation can reach a query.',
          failure_mode: 'Injection risk',
          trigger_conditions: ['User-controlled input is concatenated.']
        },
        why_it_matters: 'This can expose customer data.',
        affected_assets: ['src/db/query.ts'],
        evidence: [
          {
            kind: 'source',
            ref: 'src/db/query.ts:22-30',
            reason: 'Query is built with string concatenation.',
            codeSnippet: [
              'const query = "SELECT * FROM accounts WHERE name = \'" + user + "\'";',
              'await db.execute(query);'
            ].join('\n')
          }
        ],
        recommended_controls: ['Parameterize the query.', 'Add a regression test.']
      }
    ]
  });

  const finding = result.findings[0];
  assert.ok(finding);
  assert.match(finding.suggestedPatchCode ?? '', /Recommended code DNA for Unsafe string concatenation can reach a query\./);
  assert.match(finding.suggestedPatchCode ?? '', /Evidence citation 1: src\/db\/query\.ts:22-30/);
  assert.match(finding.suggestedPatchCode ?? '', /export function applySandboxFix\(\) \{/);
  assert.match(finding.evidence, /\[1\] Source citation: `src\/db\/query\.ts:22-30`/);
});
