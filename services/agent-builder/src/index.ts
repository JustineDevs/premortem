import { DEFAULT_GEMINI_MODEL } from '@premortem/domain';
import { isGitLabMcpEnabled } from '@premortem/integrations';
import {
  FunctionTool,
  Gemini,
  LlmAgent,
  MCPToolset,
  type StreamableHTTPConnectionParams
} from '@google/adk';
import { tracePremortemAgentMission } from '@premortem/observability';

import { buildPhoenixMcpConnection, describePhoenixRuntime } from './phoenix-mcp';

export interface AgentBuilderMissionTrace {
  engine: 'google-adk';
  model: string;
  gitlabMcpEnabled: boolean;
  steps: Array<{ step: string; at: string; detail?: Record<string, unknown> }>;
}

export interface PremortemRootAgentOptions {
  gitlabBaseUrl: string;
  gitlabToken?: string;
  model?: string;
  geminiApiKey?: string;
}

export function createMissionTrace(model = DEFAULT_GEMINI_MODEL): AgentBuilderMissionTrace {
  return {
    engine: 'google-adk',
    model,
    gitlabMcpEnabled: isGitLabMcpEnabled(),
    steps: []
  };
}

export function recordMissionStep(
  trace: AgentBuilderMissionTrace,
  step: string,
  detail?: Record<string, unknown>
) {
  trace.steps.push({
    step,
    at: new Date().toISOString(),
    ...(detail ? { detail } : {})
  });
  return trace;
}

function buildGitLabMcpConnection(input: {
  gitlabBaseUrl: string;
  gitlabToken: string;
}): StreamableHTTPConnectionParams {
  const base = input.gitlabBaseUrl.replace(/\/$/, '');
  return {
    type: 'StreamableHTTPConnectionParams',
    url: `${base}/api/v4/mcp`,
    transportOptions: {
      requestInit: {
        headers: {
          'PRIVATE-TOKEN': input.gitlabToken,
          'X-Gitlab-Mcp-Server-Tool-Name-Prefix': 'premortem'
        }
      }
    }
  };
}

export function buildPremortemRootAgent(options: PremortemRootAgentOptions) {
  const modelName = options.model ?? DEFAULT_GEMINI_MODEL;
  const apiKey =
    options.geminiApiKey ??
    process.env.GEMINI_API_KEY ??
    process.env.GOOGLE_GENAI_API_KEY ??
    '';
  if (!apiKey.trim()) {
    throw new Error(
      'GEMINI_API_KEY (or GOOGLE_GENAI_API_KEY) is required for the Agent Builder root agent.'
    );
  }
  const model = new Gemini({ model: modelName, apiKey });

  const tools: Array<FunctionTool | MCPToolset> = [
    new FunctionTool({
      name: 'premortem_record_mission_step',
      description: 'Record a Premortem multi-step audit mission checkpoint for human review.',
      execute: async () => ({
        recorded: true,
        at: new Date().toISOString()
      })
    })
  ];

  if (options.gitlabToken) {
    tools.push(
      new MCPToolset(buildGitLabMcpConnection({
        gitlabBaseUrl: options.gitlabBaseUrl,
        gitlabToken: options.gitlabToken
      }), undefined, 'premortem')
    );
  }

  const phoenixMcp = buildPhoenixMcpConnection();
  if (phoenixMcp) {
    tools.push(new MCPToolset(phoenixMcp, undefined, 'phoenix'));
  }

  return new LlmAgent({
    name: 'premortem_predictive_audit_agent',
    model,
    description:
      'Google Cloud Agent Builder root agent for Premortem predictive audits with GitLab MCP tools.',
    instruction: [
      'You orchestrate Premortem predictive code audits for GitLab projects.',
      'Use GitLab MCP tools (prefixed premortem_) to read pipelines, jobs, and open issues.',
      'Use Phoenix MCP tools (prefixed phoenix_) to inspect your own traces, experiments, prompts, and datasets.',
      'When quality drifts, query recent Phoenix traces for this project and adjust the audit strategy.',
      'Coordinate multi-step analysis: ingest repository context, inspect CI history,',
      'surface predicted failures, and prepare human-reviewed issue candidates.',
      'Never publish issues without explicit human approval in the review console.'
    ].join(' '),
    tools
  });
}

export function resolveAgentBuilderCredentials(input: {
  gitlabBaseUrl?: string;
  gitlabToken?: string;
}) {
  return {
    gitlabBaseUrl: input.gitlabBaseUrl ?? process.env.GITLAB_BASE_URL ?? 'https://gitlab.com',
    gitlabToken: input.gitlabToken ?? process.env.GITLAB_TOKEN?.trim() ?? '',
    model: process.env.LLM_MODEL ?? DEFAULT_GEMINI_MODEL,
    geminiApiKey: process.env.GEMINI_API_KEY ?? ''
  };
}

export async function bootstrapPremortemAgentMission(input: {
  auditRunId: string;
  projectId: string;
  branch: string;
  ingestionSource: 'local' | 'gitlab';
  gitlabBaseUrl?: string;
  gitlabToken?: string;
}) {
  return tracePremortemAgentMission(async () => bootstrapPremortemAgentMissionCore(input), {
    name: 'premortem.agent_mission'
  })();
}

async function bootstrapPremortemAgentMissionCore(input: {
  auditRunId: string;
  projectId: string;
  branch: string;
  ingestionSource: 'local' | 'gitlab';
  gitlabBaseUrl?: string;
  gitlabToken?: string;
}) {
  const credentials = resolveAgentBuilderCredentials(input);
  const trace = createMissionTrace(credentials.model);
  recordMissionStep(trace, 'mission.start', {
    auditRunId: input.auditRunId,
    projectId: input.projectId,
    branch: input.branch,
    ingestionSource: input.ingestionSource
  });

  if (credentials.gitlabToken && input.ingestionSource === 'gitlab') {
    if (credentials.geminiApiKey) {
      buildPremortemRootAgent({
        gitlabBaseUrl: credentials.gitlabBaseUrl,
        gitlabToken: credentials.gitlabToken,
        model: credentials.model,
        geminiApiKey: credentials.geminiApiKey
      });
      recordMissionStep(trace, 'agent_builder.root_agent.ready', {
        gitlabMcpUrl: `${credentials.gitlabBaseUrl.replace(/\/$/, '')}/api/v4/mcp`,
        toolPrefix: 'premortem'
      });
    } else {
      recordMissionStep(trace, 'agent_builder.root_agent.pending_api_key', {
        gitlabMcpUrl: `${credentials.gitlabBaseUrl.replace(/\/$/, '')}/api/v4/mcp`,
        toolPrefix: 'premortem'
      });
    }
  } else {
    recordMissionStep(trace, 'agent_builder.root_agent.local_mode', {
      reason: 'gitlab credentials unavailable or local ingest forced'
    });
  }

  recordMissionStep(trace, 'mission.ingest.delegated', {
    orchestrator: '@premortem/orchestrator'
  });

  const phoenix = describePhoenixRuntime();
  recordMissionStep(trace, 'observability.phoenix', phoenix);

  return trace;
}

export { buildPhoenixMcpConnection, describePhoenixRuntime } from './phoenix-mcp';
