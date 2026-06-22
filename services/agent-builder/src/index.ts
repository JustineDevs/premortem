import { DEFAULT_GEMINI_MODEL } from '@premortem/domain';
import { fetchOrbitContext, isGitLabMcpEnabled } from '@premortem/integrations';
import {
  FunctionTool,
  Gemini,
  LlmAgent,
  MCPToolset,
  type LlmAgentConfig,
  type StreamableHTTPConnectionParams
} from '@google/adk';
import { tracePremortemAgentMission, tracePremortemToolCall } from '@premortem/observability/phoenix';

import { buildPhoenixMcpConnection, describePhoenixRuntime } from './phoenix-mcp';

export interface AgentBuilderRuntimeConfig {
  gitlabBaseUrl: string;
  gitlabToken?: string;
  model: string;
  geminiApiKey?: string;
  vertexai: boolean;
  project?: string;
  location?: string;
  sessionDatabaseUrl?: string;
}

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
  vertexai?: boolean;
  project?: string;
  location?: string;
}

const loadOrbitContextParameters = {
  type: 'OBJECT',
  properties: {
    externalProjectId: {
      type: 'STRING',
      minLength: '1',
      description: 'The GitLab project full path or Orbit project identifier.'
    },
    branch: {
      type: 'STRING',
      minLength: '1',
      description: 'The target branch to ground the audit against.'
    },
    prefixes: {
      type: 'ARRAY',
      items: {
        type: 'STRING',
        minLength: '1'
      },
      description: 'Optional repository prefixes to include in Orbit definition lookups.'
    },
    maxDefinitionsPerPrefix: {
      type: 'INTEGER',
      minimum: 1,
      maximum: 200,
      description: 'Optional cap for definitions loaded per prefix.'
    },
    maxMergeRequests: {
      type: 'INTEGER',
      minimum: 1,
      maximum: 50,
      description: 'Optional cap for recent merge requests loaded from Orbit.'
    },
    maxPipelines: {
      type: 'INTEGER',
      minimum: 1,
      maximum: 50,
      description: 'Optional cap for recent pipelines loaded from Orbit.'
    },
    timeoutMs: {
      type: 'INTEGER',
      minimum: 1,
      maximum: 120000,
      description: 'Optional timeout for Orbit lookups in milliseconds.'
    }
  },
  required: ['externalProjectId', 'branch']
} as const;

export const PREMORTEM_GEMINI_SAFETY_SETTINGS = [
  {
    category: 'HARM_CATEGORY_HARASSMENT',
    threshold: 'BLOCK_MEDIUM_AND_ABOVE'
  },
  {
    category: 'HARM_CATEGORY_HATE_SPEECH',
    threshold: 'BLOCK_MEDIUM_AND_ABOVE'
  },
  {
    category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT',
    threshold: 'BLOCK_MEDIUM_AND_ABOVE'
  },
  {
    category: 'HARM_CATEGORY_DANGEROUS_CONTENT',
    threshold: 'BLOCK_LOW_AND_ABOVE'
  },
  {
    category: 'HARM_CATEGORY_JAILBREAK',
    threshold: 'BLOCK_LOW_AND_ABOVE'
  }
] as unknown as NonNullable<LlmAgentConfig['generateContentConfig']>['safetySettings'];

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

function buildOrbitAnalyzerPlan(contextStatus: 'enabled' | 'unavailable') {
  return {
    contextStatus,
    analyzers: [
      {
        name: 'ci_pipeline_auditor',
        focus: 'deployment and rollback risk',
        inputs: ['recentPipelines', 'recentMergeRequests']
      },
      {
        name: 'dependency_drift_auditor',
        focus: 'risky or stale dependency and interface drift',
        inputs: ['definitionMaps', 'recentMergeRequests']
      },
      {
        name: 'ownership_risk_auditor',
        focus: 'orphaned paths and low-ownership surface area',
        inputs: ['definitionMaps', 'recentMergeRequests']
      }
    ]
  };
}

export async function loadOrbitBackedAuditPlan(input: {
  externalProjectId: string;
  branch: string;
  prefixes?: string[];
  maxDefinitionsPerPrefix?: number;
  maxMergeRequests?: number;
  maxPipelines?: number;
  timeoutMs?: number;
}) {
  const orbitContext = await fetchOrbitContext({
    externalProjectId: input.externalProjectId,
    branch: input.branch,
    prefixes: input.prefixes,
    maxDefinitionsPerPrefix: input.maxDefinitionsPerPrefix,
    maxMergeRequests: input.maxMergeRequests,
    maxPipelines: input.maxPipelines,
    timeoutMs: input.timeoutMs
  });

  return {
    externalProjectId: input.externalProjectId,
    branch: input.branch,
    orbitContext,
    auditPlan: buildOrbitAnalyzerPlan(orbitContext?.status ?? 'unavailable'),
    grounded: orbitContext?.status === 'enabled',
    generatedAt: new Date().toISOString()
  };
}

export function buildPremortemRootAgent(options: PremortemRootAgentOptions) {
  const modelName = options.model ?? DEFAULT_GEMINI_MODEL;
  const apiKey =
    options.geminiApiKey ??
    process.env.GEMINI_API_KEY ??
    process.env.GOOGLE_GENAI_API_KEY ??
    '';
  const vertexai = options.vertexai ?? resolveAgentBuilderCredentials({}).vertexai;
  const project =
    options.project ??
    process.env.GOOGLE_CLOUD_PROJECT ??
    process.env.GOOGLE_CLOUD_PROJECT_ID ??
    process.env.GCP_PROJECT;
  const location =
    options.location ??
    process.env.GOOGLE_CLOUD_LOCATION ??
    process.env.GOOGLE_CLOUD_REGION ??
    process.env.GCP_REGION ??
    'us-central1';

  if (!apiKey.trim() && !vertexai) {
    throw new Error(
      'GEMINI_API_KEY (or GOOGLE_GENAI_API_KEY) is required for the Agent Builder root agent unless Vertex AI is enabled.'
    );
  }
  if (vertexai && !project) {
    throw new Error('GOOGLE_CLOUD_PROJECT is required when Vertex AI is enabled for the Agent Builder runtime.');
  }
  const model = new Gemini({
    model: modelName,
    apiKey: apiKey.trim() || undefined,
    vertexai,
    project: vertexai ? project : undefined,
    location: vertexai ? location : undefined
  });

  const tools: Array<FunctionTool | MCPToolset> = [
    new FunctionTool({
      name: 'premortem_record_mission_step',
      description: 'Record a Premortem multi-step audit mission checkpoint for human review.',
      execute: async () =>
        tracePremortemToolCall(
          async () => ({
            recorded: true,
            at: new Date().toISOString(),
            input: null
          }),
          {
            name: 'premortem_record_mission_step',
            kind: 'TOOL'
          }
        )
    }),
    new FunctionTool({
      name: 'premortem_load_orbit_context',
      description:
        'Load Orbit repo graph context for a GitLab project and return the analyzer plan that will ground the audit.',
      parameters: loadOrbitContextParameters as never,
      execute: async (input: Record<string, unknown>) =>
        tracePremortemToolCall(
          async () =>
            loadOrbitBackedAuditPlan(input as Parameters<typeof loadOrbitBackedAuditPlan>[0]),
          {
            name: 'premortem_load_orbit_context',
            kind: 'TOOL'
          }
        )
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
      'Premortem agent runtime for predictive audits with GitLab and Phoenix MCP tools.',
    instruction: [
      'You orchestrate Premortem predictive code audits for GitLab projects.',
      'Always load Orbit context first when the project and branch are known, then reason from the graph instead of guessing.',
      'Use GitLab MCP tools (prefixed premortem_) to read pipelines, jobs, and open issues.',
      'Use the Orbit tool to ground repository structure, CI history, and ownership before planning analyzers.',
      'Use Phoenix MCP tools (prefixed phoenix_) to inspect your own traces, experiments, prompts, and datasets.',
      'When quality drifts, query recent Phoenix traces for this project and adjust the audit strategy.',
      'Coordinate multi-step analysis: ingest repository context, inspect CI history,',
      'surface predicted failures, and prepare human-reviewed issue candidates.',
      'Never publish issues without explicit human approval in the review console.'
    ].join(' '),
    generateContentConfig: {
      safetySettings: PREMORTEM_GEMINI_SAFETY_SETTINGS as unknown as NonNullable<
        LlmAgentConfig['generateContentConfig']
      >['safetySettings']
    },
    tools
  });
}

export function resolveAgentBuilderCredentials(input: {
  gitlabBaseUrl?: string;
  gitlabToken?: string;
  model?: string;
  geminiApiKey?: string;
  vertexai?: boolean;
  project?: string;
  location?: string;
  sessionDatabaseUrl?: string;
}) {
  const geminiApiKey =
    input.geminiApiKey ??
    process.env.GEMINI_API_KEY ??
    process.env.GOOGLE_GENAI_API_KEY ??
    '';
  const project =
    input.project ??
    process.env.GOOGLE_CLOUD_PROJECT ??
    process.env.GOOGLE_CLOUD_PROJECT_ID ??
    process.env.GCP_PROJECT;
  const location =
    input.location ??
    process.env.GOOGLE_CLOUD_LOCATION ??
    process.env.GOOGLE_CLOUD_REGION ??
    process.env.GCP_REGION ??
    'us-central1';
  const explicitVertexAi =
    input.vertexai ??
    (process.env.GEMINI_USE_VERTEXAI === '1' ||
      process.env.GOOGLE_GENAI_USE_VERTEXAI === '1' ||
      process.env.GOOGLE_GENAI_VERTEXAI === '1');
  const vertexai = explicitVertexAi || (!geminiApiKey.trim() && Boolean(project));

  return {
    gitlabBaseUrl: input.gitlabBaseUrl ?? process.env.GITLAB_BASE_URL ?? 'https://gitlab.com',
    gitlabToken: input.gitlabToken ?? process.env.GITLAB_TOKEN?.trim() ?? '',
    model: input.model ?? process.env.LLM_MODEL ?? DEFAULT_GEMINI_MODEL,
    geminiApiKey,
    vertexai,
    project,
    location,
    sessionDatabaseUrl:
      input.sessionDatabaseUrl ??
      process.env.AGENT_BUILDER_SESSION_DATABASE_URL?.trim() ??
      process.env.AGENT_BUILDER_DATABASE_URL?.trim() ??
      ''
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
  const traced = await tracePremortemAgentMission(
    async () => bootstrapPremortemAgentMissionCore(input),
    {
      name: 'premortem.agent_mission'
    }
  );
  return traced();
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
  recordMissionStep(trace, 'agent_builder.runtime.config', {
    vertexai: credentials.vertexai,
    sessionPersistence: Boolean(credentials.sessionDatabaseUrl),
    projectConfigured: Boolean(credentials.project),
    locationConfigured: Boolean(credentials.location)
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
