import assert from 'node:assert/strict';
import test from 'node:test';

import { formatSourceCodeEvidence } from './evidence-projection';

test('source evidence renders file-line citations and code snippets', () => {
  const output = formatSourceCodeEvidence([
    {
      kind: 'source',
      ref: 'packages/db/src/repositories.ts:693-704',
      reason: 'Version allocation is derived from a count/read race.',
      codeSnippet: [
        'const versionCount = await tx.issueCandidateVersion.count({',
        '  where: { issueCandidateId: input.issueCandidateId }',
        '});'
      ].join('\n')
    }
  ]);

  assert.match(output, /\[1\] Source citation: `packages\/db\/src\/repositories\.ts:693-704`/);
  assert.match(output, /Reason: Version allocation is derived from a count\/read race\./);
  assert.match(output, /```ts\nconst versionCount = await tx\.issueCandidateVersion\.count\(\{/);
});
