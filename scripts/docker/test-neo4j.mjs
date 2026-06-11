import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { readGraphSnapshotFromNeo4j, writeGraphSnapshotToNeo4j } from '@premortem/integrations';

import { loadPremortemLocalEnv } from '../load-local-env.mjs';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
loadPremortemLocalEnv(repoRoot);

const auditRunId = 'docker-smoke-audit';
const projectId = 'docker-smoke-project';

const snapshot = {
  auditRunId,
  projectId,
  nodes: [
    { id: 'repo:smoke', label: 'smoke-repo', kind: 'repo' },
    { id: 'app:web', label: 'web', kind: 'package' }
  ],
  edges: [{ from: 'repo:smoke', to: 'app:web', type: 'owns' }]
};

async function main() {
  if (process.env.NEO4J_DISABLED === '1') {
    console.log(JSON.stringify({ ok: true, skipped: true, reason: 'NEO4J_DISABLED=1' }));
    return;
  }

  await writeGraphSnapshotToNeo4j(snapshot);
  const loaded = await readGraphSnapshotFromNeo4j(auditRunId);

  if (!loaded || loaded.nodes.length !== 2 || loaded.edges.length !== 1) {
    throw new Error('Neo4j round-trip failed');
  }

  console.log(
    JSON.stringify({
      ok: true,
      uri: process.env.NEO4J_URI ?? 'bolt://localhost:7687',
      nodeCount: loaded.nodes.length,
      edgeCount: loaded.edges.length
    })
  );
}

void main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
