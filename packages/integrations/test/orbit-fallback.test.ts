import assert from 'node:assert/strict';

import {
  buildOrbitEnabledContext,
  buildOrbitUnavailableContext,
  fetchOrbitContext,
  type OrbitQueryResult
} from '../src/orbit';

async function run() {
  const previousOrbitEnabled = process.env.ORBIT_ENABLED;

  try {
    process.env.ORBIT_ENABLED = '0';
    const disabled = await fetchOrbitContext({
      externalProjectId: 'group/project',
      branch: 'main'
    });
    assert.equal(disabled, null, 'disabled Orbit must short-circuit to null');
  } finally {
    if (previousOrbitEnabled === undefined) {
      delete process.env.ORBIT_ENABLED;
    } else {
      process.env.ORBIT_ENABLED = previousOrbitEnabled;
    }
  }

  const unavailable = buildOrbitUnavailableContext({
    branch: 'main',
    reason: 'Orbit project was not indexed'
  });
  assert.equal(unavailable.status, 'unavailable');
  assert.equal(unavailable.branch, 'main');
  assert.equal(unavailable.reason, 'Orbit project was not indexed');
  assert.equal(unavailable.recentMergeRequests.length, 0);
  assert.equal(unavailable.recentPipelines.length, 0);
  assert.equal(unavailable.definitionMaps.length, 0);

  const mergeRequestResult: OrbitQueryResult = {
    result: {
      nodes: [
        {
          type: 'MergeRequest',
          iid: 7,
          title: 'Stabilize repo boundary',
          state: 'opened',
          updated_at: '2026-06-20T08:00:00.000Z'
        }
      ]
    }
  };
  const pipelineResult: OrbitQueryResult = {
    result: {
      nodes: [
        {
          type: 'Pipeline',
          id: 88,
          status: 'failed',
          source: 'push',
          ref: 'main',
          created_at: '2026-06-20T08:05:00.000Z',
          duration: 31
        }
      ]
    }
  };
  const definitionResults: OrbitQueryResult[] = [
    {
      result: {
        nodes: [
          {
            type: 'Definition',
            fqn: 'services/orchestrator/src/scheduler/run-audit.ts::runAuditJob',
            name: 'runAuditJob',
            definition_type: 'Function',
            file_path: 'services/orchestrator/src/scheduler/run-audit.ts',
            start_line: 123
          }
        ]
      }
    }
  ];

  const enabled = buildOrbitEnabledContext({
    branch: 'main',
    project: { id: 42, fullPath: 'group/project', name: 'Project' },
    prefixes: ['services/orchestrator/src'],
    mergeRequestResult,
    pipelineResult,
    definitionResults
  });

  assert.equal(enabled.status, 'enabled');
  assert.equal(enabled.branch, 'main');
  assert.equal(enabled.project?.id, 42);
  assert.equal(enabled.recentMergeRequests[0]?.iid, 7);
  assert.equal(enabled.recentPipelines[0]?.id, 88);
  assert.equal(enabled.definitionMaps[0]?.prefix, 'services/orchestrator/src');
  assert.equal(enabled.definitionMaps[0]?.definitions[0]?.filePath, 'services/orchestrator/src/scheduler/run-audit.ts');

  console.log('Orbit fallback behavior verified.');
}

await run();
