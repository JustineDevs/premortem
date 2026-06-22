import { mkdtemp, writeFile, readFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

const TYPE_KINDS = [
  'Class',
  'Module',
  'Struct',
  'Enum',
  'Trait',
  'Interface',
  'Type',
  'TypeAlias',
  'Record',
  'Object',
  'Namespace'
] as const;

const CALLABLE_KINDS = [
  'Method',
  'Function',
  'AssociatedFunction',
  'SingletonMethod',
  'StaticMethod',
  'Constructor',
  'AsyncFunction'
] as const;

export interface OrbitProjectSummary {
  id: number;
  fullPath: string;
  name?: string;
}

export interface OrbitDefinitionSummary {
  fqn: string;
  name: string;
  definitionType: string;
  filePath: string;
  startLine: number | null;
}

export interface OrbitMergeRequestSummary {
  iid: number;
  title: string;
  state: string;
  updatedAt: string;
  webUrl: string;
}

export interface OrbitPipelineSummary {
  id: number;
  status: string;
  ref: string;
  source: string;
  createdAt: string;
  durationSeconds: number | null;
  webUrl: string;
}

export interface OrbitPrefixMap {
  prefix: string;
  definitions: OrbitDefinitionSummary[];
}

export interface OrbitContext {
  status: 'enabled' | 'unavailable';
  reason?: string;
  generatedAt: string;
  branch: string;
  project?: OrbitProjectSummary;
  recentMergeRequests: OrbitMergeRequestSummary[];
  recentPipelines: OrbitPipelineSummary[];
  definitionMaps: OrbitPrefixMap[];
}

export interface OrbitContextInput {
  externalProjectId: string;
  branch: string;
  prefixes?: string[];
  maxDefinitionsPerPrefix?: number;
  maxMergeRequests?: number;
  maxPipelines?: number;
  timeoutMs?: number;
}

interface OrbitQueryResult {
  result?: {
    nodes?: Array<Record<string, unknown>>;
    edges?: Array<Record<string, unknown>>;
  };
}

function isOrbitDisabledExplicitly() {
  return process.env.ORBIT_ENABLED === '0';
}

async function runOrbitQuery(body: Record<string, unknown>, timeoutMs: number): Promise<OrbitQueryResult> {
  const tempDir = await mkdtemp(path.join(os.tmpdir(), 'premortem-orbit-'));
  const queryPath = path.join(tempDir, 'query.json');
  await writeFile(queryPath, JSON.stringify(body, null, 2));

  try {
    const response = await execFileAsync('glab', ['orbit', 'remote', 'query', '--format', 'raw', queryPath], {
      timeout: timeoutMs,
      maxBuffer: 10 * 1024 * 1024
    });
    return JSON.parse(String(response.stdout)) as OrbitQueryResult;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Orbit query failed: ${message}`);
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
}

function readNodes(result: OrbitQueryResult, nodeType = 'Definition') {
  return (result.result?.nodes ?? []).filter((node) => node && (node as { type?: string }).type === nodeType);
}

function readProjectNode(result: OrbitQueryResult): OrbitProjectSummary | null {
  const node = readNodes(result, 'Project')[0];
  if (!node) return null;

  const id = Number(node.id ?? NaN);
  const fullPath = typeof node.full_path === 'string' ? node.full_path : '';
  if (!Number.isFinite(id) || !fullPath) return null;

  return {
    id,
    fullPath,
    name: typeof node.name === 'string' ? node.name : undefined
  };
}

function readDefinitions(result: OrbitQueryResult): OrbitDefinitionSummary[] {
  return readNodes(result, 'Definition')
    .map((node) => {
      const fqn = typeof node.fqn === 'string' ? node.fqn : typeof node.name === 'string' ? node.name : '';
      const name = typeof node.name === 'string' ? node.name : fqn;
      const definitionType =
        typeof node.definition_type === 'string' ? node.definition_type : typeof node.type === 'string' ? node.type : '';
      const filePath = typeof node.file_path === 'string' ? node.file_path : '';
      const startLine = Number.isFinite(Number(node.start_line)) ? Number(node.start_line) : null;
      if (!fqn || !definitionType || !filePath) return null;
      return {
        fqn,
        name,
        definitionType,
        filePath,
        startLine
      } satisfies OrbitDefinitionSummary;
    })
    .filter((node): node is OrbitDefinitionSummary => node !== null);
}

function readMergeRequests(result: OrbitQueryResult): OrbitMergeRequestSummary[] {
  return readNodes(result, 'MergeRequest')
    .map((node) => {
      const iid = Number(node.iid ?? NaN);
      const title = typeof node.title === 'string' ? node.title : '';
      const state = typeof node.state === 'string' ? node.state : 'unknown';
      const updatedAt =
        typeof node.updated_at === 'string'
          ? node.updated_at
          : typeof node.updatedAt === 'string'
            ? node.updatedAt
            : '';
      const webUrl =
        typeof node.web_url === 'string'
          ? node.web_url
          : typeof node.webUrl === 'string'
            ? node.webUrl
            : '';
      if (!Number.isFinite(iid) || !title || !updatedAt) return null;
      return { iid, title, state, updatedAt, webUrl };
    })
    .filter((row): row is OrbitMergeRequestSummary => row !== null);
}

function readPipelines(result: OrbitQueryResult): OrbitPipelineSummary[] {
  return readNodes(result, 'Pipeline')
    .map((node) => {
      const id = Number(node.id ?? NaN);
      const status = typeof node.status === 'string' ? node.status : 'unknown';
      const ref = typeof node.ref === 'string' ? node.ref : '';
      const source = typeof node.source === 'string' ? node.source : 'unknown';
      const createdAt = typeof node.created_at === 'string' ? node.created_at : '';
      const durationSeconds = Number.isFinite(Number(node.duration)) ? Number(node.duration) : null;
      const webUrl =
        typeof node.web_url === 'string'
          ? node.web_url
          : typeof node.webUrl === 'string'
            ? node.webUrl
            : '';
      if (!Number.isFinite(id) || !ref || !createdAt) return null;
      return { id, status, ref, source, createdAt, durationSeconds, webUrl };
    })
    .filter((row): row is OrbitPipelineSummary => row !== null);
}

export function buildOrbitUnavailableContext(input: {
  branch: string;
  reason: string;
}): OrbitContext {
  return {
    status: 'unavailable',
    reason: input.reason,
    generatedAt: new Date().toISOString(),
    branch: input.branch,
    recentMergeRequests: [],
    recentPipelines: [],
    definitionMaps: []
  };
}

export function buildOrbitEnabledContext(input: {
  branch: string;
  project: OrbitProjectSummary;
  prefixes: string[];
  mergeRequestResult: OrbitQueryResult;
  pipelineResult: OrbitQueryResult;
  definitionResults: OrbitQueryResult[];
}): OrbitContext {
  return {
    status: 'enabled',
    generatedAt: new Date().toISOString(),
    branch: input.branch,
    project: input.project,
    recentMergeRequests: readMergeRequests(input.mergeRequestResult),
    recentPipelines: readPipelines(input.pipelineResult),
    definitionMaps: input.prefixes.map((prefix, index) => ({
      prefix,
      definitions: readDefinitions(input.definitionResults[index] ?? { result: { nodes: [] } })
    }))
  };
}

function buildDefinitionQuery(projectId: number, branch: string, prefix: string, limit: number) {
  const normalizedPrefix = prefix.replace(/\/$/, '');
  return {
    query: {
      query_type: 'traversal',
      node: {
        id: 'd',
        entity: 'Definition',
        filters: {
          project_id: { op: 'eq', value: projectId },
          branch: { op: 'eq', value: branch },
          file_path: { op: 'starts_with', value: `${normalizedPrefix}/` },
          definition_type: { op: 'in', value: [...TYPE_KINDS, ...CALLABLE_KINDS] }
        },
        columns: ['fqn', 'name', 'definition_type', 'file_path', 'start_line']
      },
      order_by: { node: 'd', property: 'file_path', direction: 'ASC' },
      limit
    }
  };
}

async function lookupOrbitProject(input: OrbitContextInput, timeoutMs: number): Promise<OrbitProjectSummary | null> {
  const body = {
    query: {
      query_type: 'traversal',
      node: {
        id: 'p',
        entity: 'Project',
        columns: ['id', 'full_path', 'name'],
        filters: { full_path: { op: 'eq', value: input.externalProjectId } }
      },
      limit: 1
    }
  };

  const result = await runOrbitQuery(body, timeoutMs);
  return readProjectNode(result);
}

export async function fetchOrbitContext(input: OrbitContextInput): Promise<OrbitContext | null> {
  if (isOrbitDisabledExplicitly()) return null;
  if (!input.externalProjectId.trim()) return null;

  const timeoutMs = input.timeoutMs ?? 15_000;
  const prefixes = (input.prefixes ?? [
    'services/orchestrator/src',
    'packages/integrations/src',
    'packages/db/src'
  ])
    .map((prefix) => prefix.trim())
    .filter(Boolean);

  try {
    const project = await lookupOrbitProject(input, timeoutMs);
    if (!project) {
      return buildOrbitUnavailableContext({
        branch: input.branch,
        reason: `Orbit project ${input.externalProjectId} was not indexed or could not be resolved`
      });
    }

    const [mergeRequestResult, pipelineResult, ...definitionResults] = await Promise.all([
      runOrbitQuery(
        {
          query: {
            query_type: 'traversal',
            node: {
              id: 'mr',
              entity: 'MergeRequest',
              columns: ['iid', 'title', 'state', 'updated_at'],
              filters: { project_id: { op: 'eq', value: project.id } }
            },
            order_by: { node: 'mr', property: 'updated_at', direction: 'DESC' },
            limit: input.maxMergeRequests ?? 5
          }
        },
        timeoutMs
      ),
      runOrbitQuery(
        {
          query: {
            query_type: 'traversal',
            node: {
              id: 'pipeline',
              entity: 'Pipeline',
              columns: ['id', 'status', 'source', 'ref', 'created_at', 'duration'],
              filters: {
                project_id: { op: 'eq', value: project.id },
                ref: { op: 'eq', value: input.branch }
              }
            },
            order_by: { node: 'pipeline', property: 'created_at', direction: 'DESC' },
            limit: input.maxPipelines ?? 5
          }
        },
        timeoutMs
      ),
      ...prefixes.map((prefix) =>
        runOrbitQuery(buildDefinitionQuery(project.id, input.branch, prefix, input.maxDefinitionsPerPrefix ?? 30), timeoutMs)
      )
    ]);

    return buildOrbitEnabledContext({
      branch: input.branch,
      project,
      prefixes,
      mergeRequestResult,
      pipelineResult,
      definitionResults
    });
  } catch (error) {
    return buildOrbitUnavailableContext({
      branch: input.branch,
      reason: error instanceof Error ? error.message : String(error)
    });
  }
}
