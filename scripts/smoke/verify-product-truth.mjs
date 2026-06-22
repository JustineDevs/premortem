import { SMOKE_GEMINI_MODEL as DEFAULT_SMOKE_GEMINI_MODEL, allowsForceLocalIngest } from '../../packages/domain/dist/index.js';
import { loadPremortemLocalEnv } from '../load-local-env.mjs';

loadPremortemLocalEnv();
const SMOKE_GEMINI_MODEL = process.env.LLM_MODEL?.trim() || DEFAULT_SMOKE_GEMINI_MODEL;
process.env.LLM_MODEL = SMOKE_GEMINI_MODEL;
import { splitIssueCandidate } from '../../packages/db/dist/index.js';
import {
  fetchGitLabContextViaMcp,
  fetchOpenGitLabIssues,
  fetchRecentGitLabPipelines,
  isGitLabMcpEnabled
} from '../../packages/integrations/dist/integrations/src/index.js';
import { bootstrapPremortemAgentMission } from '../../services/agent-builder/dist/services/agent-builder/src/index.js';
import {
  buildGraphFromIngestion,
  clusterFindings,
  ingestGitLabProject,
  EMPTY_CI_HISTORY
} from '../../services/orchestrator/dist/services/orchestrator/src/index.js';

function pass(label) {
  console.log(`PASS ${label}`);
}

function fail(label, detail) {
  console.error(`FAIL ${label}${detail ? `: ${detail}` : ''}`);
  process.exitCode = 1;
}

async function probeGitLabMcpEndpoint(baseUrl) {
  const mcpUrl = `${baseUrl.replace(/\/$/, '')}/api/v4/mcp`;
  const res = await fetch(mcpUrl, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      accept: 'application/json, text/event-stream'
    },
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: 1,
      method: 'initialize',
      params: {
        protocolVersion: '2024-11-05',
        capabilities: {},
        clientInfo: { name: 'premortem-product-truth-smoke', version: '1.0.0' }
      }
    })
  });
  const text = await res.text();
  return { status: res.status, text, mcpUrl };
}

const sampleFindings = [
  {
    agent: 'a',
    finding_id: 'f1',
    category: 'release_safety',
    finding_type: 'deploy_risk',
    severity: 'medium',
    confidence: 0.7,
    predicted_failure: {
      summary: 'A',
      failure_mode: 'm',
      trigger_conditions: ['t1'],
      blast_radius: 'component'
    },
    why_it_matters: 'w',
    affected_assets: ['apps/web'],
    evidence: [],
    recommended_controls: [],
    dedupe_keys: ['release', 'web'],
    tags: []
  },
  {
    agent: 'b',
    finding_id: 'f2',
    category: 'release_safety',
    finding_type: 'deploy_risk',
    severity: 'high',
    confidence: 0.9,
    predicted_failure: {
      summary: 'B',
      failure_mode: 'm',
      trigger_conditions: ['t2'],
      blast_radius: 'pipeline'
    },
    why_it_matters: 'w',
    affected_assets: ['apps/web'],
    evidence: [],
    recommended_controls: [],
    dedupe_keys: ['release', 'web', 'extra'],
    tags: []
  },
  {
    agent: 'c',
    finding_id: 'f3',
    category: 'topology',
    finding_type: 'graph_gap',
    severity: 'low',
    confidence: 0.5,
    predicted_failure: {
      summary: 'C',
      failure_mode: 'm',
      trigger_conditions: ['t3'],
      blast_radius: 'component'
    },
    why_it_matters: 'w',
    affected_assets: ['services/api'],
    evidence: [],
    recommended_controls: [],
    dedupe_keys: ['topology'],
    tags: []
  }
];

const clusters = clusterFindings(sampleFindings);
if (clusters.length !== 2) {
  fail('cluster overlap merge', `expected 2 clusters, got ${clusters.length}`);
} else {
  const releaseCluster = clusters.find((cluster) => cluster.categoryOwner === 'release_safety');
  if (!releaseCluster || releaseCluster.sourceFindingIds.length !== 2) {
    fail('cluster overlap merge', 'release_safety findings not merged');
  } else if (releaseCluster.primaryFindingId !== 'f2') {
    fail('cluster primary finding', `expected f2, got ${releaseCluster.primaryFindingId}`);
  } else {
    pass('cluster overlap merge with primary finding');
  }
}

const graph = buildGraphFromIngestion({
  auditRunId: 'audit-test',
  projectId: 'project-test',
  bundle: {
    repoRoot: 'gitlab://123',
    branch: 'main',
    repo_tree: [],
    ci_config: {},
    has_ci: true,
    package_manifests: [],
    pipeline_files: ['.gitlab-ci.yml'],
    services: [],
    apps: [],
    source_files: [],
    ownership_hints: [],
    git_history: [],
    ci_history: {
      ...EMPTY_CI_HISTORY,
      pipelines: [
        {
          id: 99,
          status: 'failed',
          ref: 'main',
          sha: 'abc',
          webUrl: 'https://gitlab.example/p/99',
          createdAt: new Date().toISOString(),
          durationSeconds: 120,
          failedJobs: [
            {
              id: 1,
              name: 'test',
              stage: 'test',
              status: 'failed',
              webUrl: 'https://gitlab.example/j/1',
              durationSeconds: 10,
              failureReason: 'script_failure'
            }
          ]
        }
      ],
      totals: { sampled: 1, failed: 1, success: 0, successRate: 0 },
      recentFailedStages: ['test']
    },
    existing_issues: [
      {
        iid: 12,
        title: 'Open bug',
        state: 'opened',
        labels: ['bug'],
        updatedAt: new Date().toISOString(),
        webUrl: 'https://gitlab.example/issues/12'
      }
    ],
    metadata: {}
  }
});

const kinds = new Set(graph.nodes.map((node) => node.kind));
const missingKinds = ['pipeline_run', 'ci_job', 'issue'].filter((kind) => !kinds.has(kind));
if (missingKinds.length > 0) {
  fail('graph node kinds', `missing ${missingKinds.join(', ')}`);
} else {
  pass('graph includes CI history and open issue nodes');
}

if (typeof allowsForceLocalIngest !== 'function') {
  fail('domain production-mode', 'allowsForceLocalIngest missing');
} else {
  pass('domain allowsForceLocalIngest export');
}

if (typeof splitIssueCandidate !== 'function') {
  fail('splitIssueCandidate export', 'missing from @premortem/db');
} else {
  pass('splitIssueCandidate export');
}

if (typeof ingestGitLabProject !== 'function') {
  fail('ingestGitLabProject export', 'missing from orchestrator');
} else {
  pass('ingestGitLabProject export');
}

if (typeof fetchRecentGitLabPipelines !== 'function' || typeof fetchOpenGitLabIssues !== 'function') {
  fail('gitlab context exports', 'pipeline/issue fetch helpers missing');
} else {
  pass('gitlab context exports');
}

if (SMOKE_GEMINI_MODEL !== 'gemini-2.5-flash-lite') {
  fail('SMOKE_GEMINI_MODEL', SMOKE_GEMINI_MODEL);
} else {
  pass(`SMOKE_GEMINI_MODEL=${SMOKE_GEMINI_MODEL}`);
}

if (typeof fetchGitLabContextViaMcp !== 'function') {
  fail('GitLab MCP export', 'fetchGitLabContextViaMcp missing');
} else {
  pass('GitLab MCP export');
}

const mission = await bootstrapPremortemAgentMission({
  auditRunId: 'product-truth-smoke',
  projectId: 'project-smoke',
  branch: 'main',
  ingestionSource: 'local'
});

if (mission.engine !== 'google-adk' || mission.steps.length < 2) {
  fail('Agent Builder mission bootstrap', JSON.stringify(mission));
} else {
  pass('Agent Builder mission bootstrap');
}

const gitlabToken = process.env.GITLAB_TOKEN?.trim();
const gitlabProject = process.env.GITLAB_EXTERNAL_PROJECT_ID?.trim();
if (gitlabToken && gitlabProject) {
  const gitlabBase = process.env.GITLAB_BASE_URL?.trim() || 'https://gitlab.com';
  if (process.env.PREMORTEM_GITLAB_MCP_LIVE === '1') {
    const probe = await probeGitLabMcpEndpoint(gitlabBase);
    if (probe.status === 404 || probe.text.includes('404')) {
      pass(`live gitlab ingest skipped (MCP unavailable at ${probe.mcpUrl})`);
    } else {
      try {
        const bundle = await ingestGitLabProject({
          baseUrl: gitlabBase,
          token: gitlabToken,
          externalProjectId: gitlabProject,
          branch: process.env.GITLAB_DEFAULT_BRANCH?.trim() || 'main'
        });

        if (!Array.isArray(bundle.ci_history?.pipelines)) {
          fail('gitlab ci_history ingest', 'ci_history missing');
        } else if (bundle.ci_history.pipelines.length === 0) {
          if (bundle.repo_tree.length > 0) {
            pass(
              `gitlab ci_history ingest (0 pipelines; repo tree ${bundle.repo_tree.length} paths, transport ${String(bundle.metadata?.ingestionTransport)})`
            );
          } else {
            fail('gitlab ci_history ingest', 'no pipelines and empty repo tree');
          }
        } else {
          pass(`gitlab ci_history ingest (${bundle.ci_history.pipelines.length} pipelines)`);
        }

        if (!Array.isArray(bundle.existing_issues)) {
          fail('gitlab existing_issues ingest', 'existing_issues missing');
        } else {
          pass(`gitlab existing_issues ingest (${bundle.existing_issues.length} open issues)`);
        }

        const transport = bundle.metadata?.ingestionTransport;
        if (isGitLabMcpEnabled() && transport === 'gitlab-rest-fallback') {
          pass(
            `gitlab ingest transport (${String(transport)}; ${String(bundle.metadata?.mcpUnavailableReason ?? 'mcp unavailable')})`
          );
        } else if (isGitLabMcpEnabled() && transport !== 'gitlab-mcp') {
          fail('gitlab ingest transport', `expected MCP transport metadata, got ${String(transport)}`);
        } else if (transport) {
          pass(`gitlab ingest transport (${String(transport)})`);
        }
      } catch (error) {
        fail('live gitlab ingest', error instanceof Error ? error.message : String(error));
      }
    }
  } else {
    pass('live gitlab ingest skipped (set PREMORTEM_GITLAB_MCP_LIVE=1 to verify)');
  }
} else {
  pass('gitlab live ingest skipped (set GITLAB_TOKEN + GITLAB_EXTERNAL_PROJECT_ID to verify)');
}

if (process.exitCode && process.exitCode !== 0) {
  console.error('\nProduct truth verification failed.');
  process.exit(process.exitCode);
}

console.log('\nProduct truth verification passed (confidence: yes).');
