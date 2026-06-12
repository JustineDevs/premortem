import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

import { loadPremortemLocalEnv } from '../load-local-env.mjs';

loadPremortemLocalEnv();

import {
  DEFAULT_GEMINI_MODEL,
  allowsForceLocalIngest
} from '../../packages/domain/dist/index.js';
import {
  fetchGitLabContextViaMcp,
  isGitLabMcpEnabled
} from '../../packages/integrations/dist/integrations/src/index.js';
import {
  bootstrapPremortemAgentMission,
  buildPremortemRootAgent,
  describePhoenixRuntime
} from '../../services/agent-builder/dist/services/agent-builder/src/index.js';
import {
  evaluateAuditMissionQuality,
  evaluateAuditMissionWithLlmJudge,
  evaluatePremortemAuditMission,
  initPhoenixTracing,
  isPhoenixClientConfigured,
  isPhoenixEnabled,
  isPhoenixLlmEvalEnabled,
  PREMORTEM_PHOENIX_CODE_EVALUATOR_PATH
} from '../../packages/observability/dist/index.js';

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
        clientInfo: { name: 'premortem-hackathon-smoke', version: '1.0.0' }
      }
    })
  });
  const text = await res.text();
  return { status: res.status, text, mcpUrl };
}

const repoRoot = resolve(import.meta.dirname, '../..');
const licensePath = resolve(repoRoot, 'LICENSE');

if (!existsSync(licensePath)) {
  fail('LICENSE file', 'missing at repo root');
} else {
  const licenseText = readFileSync(licensePath, 'utf8');
  if (!/Apache License/.test(licenseText)) {
    fail('LICENSE file', 'expected Apache-2.0');
  } else {
    pass('LICENSE (Apache-2.0)');
  }
}

if (DEFAULT_GEMINI_MODEL !== 'gemini-3-flash-preview') {
  fail('DEFAULT_GEMINI_MODEL', `expected gemini-3-flash-preview, got ${DEFAULT_GEMINI_MODEL}`);
} else {
  pass(`DEFAULT_GEMINI_MODEL=${DEFAULT_GEMINI_MODEL}`);
}

if (typeof fetchGitLabContextViaMcp !== 'function' || typeof isGitLabMcpEnabled !== 'function') {
  fail('GitLab MCP client exports', 'missing from @premortem/integrations');
} else {
  pass('GitLab MCP client exports');
}

if (typeof buildPremortemRootAgent !== 'function' || typeof bootstrapPremortemAgentMission !== 'function') {
  fail('Agent Builder exports', 'missing from @premortem/agent-builder');
} else {
  pass('Agent Builder (@google/adk) exports');
}

const mission = await bootstrapPremortemAgentMission({
  auditRunId: 'hackathon-smoke',
  projectId: 'project-smoke',
  branch: 'main',
  ingestionSource: 'gitlab'
});

if (mission.engine !== 'google-adk') {
  fail('agent mission engine', `expected google-adk, got ${mission.engine}`);
} else if (mission.model !== DEFAULT_GEMINI_MODEL) {
  fail('agent mission model', mission.model);
} else if (mission.steps.length < 2) {
  fail('agent mission steps', 'expected multi-step trace');
} else {
  pass(`Agent Builder mission trace (${mission.steps.length} steps)`);
}

const rootAgent = buildPremortemRootAgent({
  gitlabBaseUrl: process.env.GITLAB_BASE_URL?.trim() || 'https://gitlab.com',
  gitlabToken: process.env.GITLAB_TOKEN?.trim() || 'smoke-token',
  model: DEFAULT_GEMINI_MODEL,
  geminiApiKey: process.env.GEMINI_API_KEY?.trim() || process.env.GOOGLE_GENAI_API_KEY?.trim() || 'smoke-local-definition-only'
});

if (!rootAgent || rootAgent.name !== 'premortem_predictive_audit_agent') {
  fail('premortem root agent', 'unexpected agent definition');
} else {
  pass('premortem_predictive_audit_agent root agent');
}

if (typeof allowsForceLocalIngest !== 'function') {
  fail('domain production-mode', 'allowsForceLocalIngest missing');
} else {
  pass('domain allowsForceLocalIngest export');
}

const gitlabToken = process.env.GITLAB_TOKEN?.trim();
const gitlabProject = process.env.GITLAB_EXTERNAL_PROJECT_ID?.trim();
const gitlabBase = process.env.GITLAB_BASE_URL?.trim() || 'https://gitlab.com';

if (gitlabToken && gitlabProject) {
  try {
    const { status, text, mcpUrl } = await probeGitLabMcpEndpoint(gitlabBase);
    if (status === 404 || text.includes('404')) {
      fail('GitLab MCP server', 'POST /api/v4/mcp returned 404 — enable GitLab Duo + beta/experimental');
    } else if (status === 401 || /unauthorized/i.test(text)) {
      pass(`GitLab MCP server (${mcpUrl}; OAuth in Cursor, not PAT)`);
    } else if (status >= 200 && status < 300) {
      pass(`GitLab MCP server (${mcpUrl} reachable)`);
    } else {
      fail('GitLab MCP server', `${status} ${text.slice(0, 120)}`);
    }
  } catch (error) {
    fail('GitLab MCP server', error instanceof Error ? error.message : String(error));
  }

  if (process.env.PREMORTEM_GITLAB_MCP_LIVE === '1' && isGitLabMcpEnabled()) {
    try {
      const mcpContext = await fetchGitLabContextViaMcp({
        baseUrl: gitlabBase,
        token: gitlabToken,
        externalProjectId: gitlabProject,
        ref: process.env.GITLAB_DEFAULT_BRANCH?.trim() || 'main',
        toolPrefix: 'premortem'
      });

      if (mcpContext.toolCalls.length === 0) {
        fail('live GitLab MCP (PAT)', 'no tool calls recorded');
      } else {
        pass(`live GitLab MCP via PAT (${mcpContext.toolCalls.join(', ')})`);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      fail('live GitLab MCP (PAT)', message);
    }
  }
} else {
  pass('GitLab MCP ingest skipped (set GITLAB_TOKEN + GITLAB_EXTERNAL_PROJECT_ID)');
}

const phoenixScript = resolve(repoRoot, 'scripts/mcp/run-phoenix-mcp.sh');
if (!existsSync(phoenixScript)) {
  fail('Phoenix MCP script', 'scripts/mcp/run-phoenix-mcp.sh missing');
} else {
  pass('Phoenix MCP launcher script');
}

if (typeof initPhoenixTracing !== 'function' || typeof evaluateAuditMissionQuality !== 'function') {
  fail('Phoenix OpenInference exports', 'missing from @premortem/observability');
} else {
  pass('Phoenix OpenInference exports');
}

if (
  typeof evaluatePremortemAuditMission !== 'function' ||
  typeof isPhoenixClientConfigured !== 'function' ||
  !PREMORTEM_PHOENIX_CODE_EVALUATOR_PATH
) {
  fail('Phoenix client SDK exports', 'missing datasets/prompts/code-evaluator exports');
} else {
  pass('Phoenix client SDK exports');
}

const phoenixCodeEval = evaluatePremortemAuditMission({
  output: { findingCount: 2, issueCandidateCount: 1, hasHumanReviewGate: true }
});
if (phoenixCodeEval.label !== 'passed') {
  fail('Phoenix server-style code eval', JSON.stringify(phoenixCodeEval));
} else {
  pass(`Phoenix server-style code eval (${phoenixCodeEval.label})`);
}

const phoenixRuntime = describePhoenixRuntime();
const phoenixStep = mission.steps.find((step) => step.step === 'observability.phoenix');
if (!phoenixStep) {
  fail('Phoenix mission step', 'observability.phoenix missing from agent mission trace');
} else {
  pass(`Phoenix runtime metadata (${phoenixRuntime.enabled ? 'enabled' : 'disabled'})`);
}

const evalResult = evaluateAuditMissionQuality({
  auditRunId: 'hackathon-smoke',
  findingCount: 3,
  issueCandidateCount: 2,
  hasHumanReviewGate: true
});
if (!evalResult.passed || evalResult.evaluator !== 'premortem-code-eval') {
  fail('Phoenix code eval', JSON.stringify(evalResult));
} else {
  pass(`Phoenix code eval (score ${evalResult.score.toFixed(2)})`);
}

const geminiKey = process.env.GEMINI_API_KEY?.trim() || process.env.GOOGLE_GENAI_API_KEY?.trim();
if (isPhoenixLlmEvalEnabled() && geminiKey) {
  try {
    const llmEval = await evaluateAuditMissionWithLlmJudge({
      auditRunId: 'hackathon-smoke',
      findingCount: 3,
      issueCandidateCount: 2,
      sampleFindingTitles: ['Missing auth guard on admin route', 'Unbounded query in list endpoint'],
      apiKey: geminiKey
    });
    pass(`Phoenix LLM-as-judge eval (${llmEval.label}, score ${llmEval.score.toFixed(2)})`);
  } catch (error) {
    fail('Phoenix LLM-as-judge eval', error instanceof Error ? error.message : String(error));
  }
} else {
  pass('Phoenix LLM-as-judge eval skipped (set PHOENIX_LLM_EVAL=1 and GEMINI_API_KEY)');
}

if (process.env.PHOENIX_API_KEY?.trim()) {
  initPhoenixTracing('hackathon-smoke');
  pass('Phoenix tracing register (PHOENIX_API_KEY present)');
} else {
  pass('Phoenix tracing skipped (set PHOENIX_API_KEY for live export)');
}

if (process.exitCode && process.exitCode !== 0) {
  console.error('\nHackathon readiness verification failed.');
  process.exit(process.exitCode);
}

console.log('\nHackathon readiness verification passed.');
