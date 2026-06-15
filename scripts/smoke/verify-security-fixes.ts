import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';

import {
  normalizeSessionPoolerUrl,
  normalizeTransactionPoolerUrl,
  shouldNormalizeSupabaseDatabaseUrl
} from '../../packages/db/src/supabase-database-url.ts';
import { isLikelyRepositoryFilePath, parseFileEvidenceRef } from '../../packages/domain/src/evidence-projection.ts';

function readRepoFile(relativePath: string): string {
  return readFileSync(path.join(process.cwd(), relativePath), 'utf8');
}

function main() {
  assert.equal(shouldNormalizeSupabaseDatabaseUrl('postgresql://localhost:5432/postgres'), false);
  assert.equal(
    shouldNormalizeSupabaseDatabaseUrl('postgresql://db.example.supabase.co:5432/postgres'),
    true
  );

  assert.equal(
    normalizeTransactionPoolerUrl('postgresql://aws-1-us-east-1.pooler.supabase.com:5432/postgres'),
    'postgresql://aws-1-us-east-1.pooler.supabase.com:6543/postgres?pgbouncer=true&sslmode=require&connection_limit=1'
  );
  assert.equal(
    normalizeSessionPoolerUrl('postgresql://aws-1-us-east-1.pooler.supabase.com:6543/postgres'),
    'postgresql://aws-1-us-east-1.pooler.supabase.com:5432/postgres?sslmode=require'
  );

  const fileRef = parseFileEvidenceRef('https://gitlab.com/org/repo/-/blob/main/src/foo.ts:12-14');
  assert.ok(fileRef);
  assert.equal(fileRef?.filePath, 'src/foo.ts');
  assert.equal(fileRef?.startLine, 12);
  assert.equal(fileRef?.endLine, 14);
  assert.equal(isLikelyRepositoryFilePath('.husky/pre-commit'), false);
  assert.equal(isLikelyRepositoryFilePath('packages/domain/src/index.ts'), true);

  const dastScanner = readRepoFile('.agents/skills/security/dast-automation/scripts/playwright_dast_scanner.py');
  assert.match(dastScanner, /Navigating to authentication page/);
  assert.doesNotMatch(dastScanner, /password123/);
  assert.doesNotMatch(dastScanner, /Navigating to: .*auth_url/);

  const agentServer = readRepoFile('services/agent-builder/src/server.ts');
  assert.doesNotMatch(agentServer, /JSON\.stringify\(\{ error: message \}/);
  assert.match(agentServer, /Internal server error/);

  console.log('security fix smoke passed');
}

main();
