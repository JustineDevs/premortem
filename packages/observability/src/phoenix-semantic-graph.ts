import { getSpans } from '@arizeai/phoenix-client/spans';

import { createPremortemPhoenixClient, isPhoenixClientConfigured } from './phoenix-client-config';

export interface PhoenixSemanticGraphNode {
  id: string;
  label: string;
  kind: string;
  spanKind?: string;
  status?: string;
}

export interface PhoenixSemanticGraphEdge {
  from: string;
  to: string;
  type?: string;
}

export interface PhoenixSemanticGraphPayload {
  configured: boolean;
  auditRunId: string;
  traceIds: string[];
  nodes: PhoenixSemanticGraphNode[];
  edges: PhoenixSemanticGraphEdge[];
  source: 'phoenix' | 'unconfigured' | 'empty';
}

interface PhoenixSpanRow {
  id: string;
  name: string;
  span_kind?: string | null;
  status_code?: string | null;
  parent_id?: string | null;
  context?: { trace_id?: string; span_id?: string };
  attributes?: Record<string, unknown>;
}

const AUDIT_SPAN_NAMES = [
  'premortem.execute_audit_job',
  'premortem.agent_mission',
  'gemini.generateContent'
] as const;

const MAX_SEMANTIC_NODES = 72;
const MAX_SEMANTIC_EDGES = 120;

function resolvePhoenixProjectName() {
  return process.env.PHOENIX_PROJECT_NAME?.trim() || 'premortem';
}

function spanNodeId(spanId: string) {
  return `phoenix:${spanId}`;
}

function normalizeSpanKind(span: PhoenixSpanRow) {
  const raw = span.span_kind?.trim();
  if (!raw) return 'span';
  return raw.toLowerCase();
}

function isNoiseHttpSpan(span: PhoenixSpanRow) {
  const origin = span.attributes?.['sentry.origin'];
  if (origin === 'auto.http.otel.node_fetch') return true;
  if (span.name === 'GET' && normalizeSpanKind(span) === 'unknown') return true;
  return false;
}

function spanLabel(span: PhoenixSpanRow) {
  const name = span.name.trim();
  if (name.length <= 28) return name;
  const parts = name.split('.');
  const tail = parts[parts.length - 1];
  if (tail && tail.length <= 28) return tail;
  return `${name.slice(0, 25)}…`;
}

function attributeMatchesAuditRun(span: PhoenixSpanRow, auditRunId: string) {
  const attributes = span.attributes ?? {};
  const candidates = [
    attributes['premortem.audit_run_id'],
    attributes['audit.run.id'],
    attributes['auditRunId']
  ];

  return candidates.some((value) => typeof value === 'string' && value === auditRunId);
}

function collectTraceIds(spans: PhoenixSpanRow[]) {
  const traceIds = new Set<string>();
  for (const span of spans) {
    const traceId = span.context?.trace_id?.trim();
    if (traceId) traceIds.add(traceId);
  }
  return [...traceIds];
}

async function fetchSpansByAuditAttribute(
  auditRunId: string,
  startTime?: Date,
  endTime?: Date
): Promise<PhoenixSpanRow[]> {
  const client = createPremortemPhoenixClient();
  const result = await getSpans({
    client,
    project: { projectName: resolvePhoenixProjectName() },
    attributes: { 'premortem.audit_run_id': auditRunId },
    startTime,
    endTime,
    limit: MAX_SEMANTIC_NODES
  });
  return result.spans as PhoenixSpanRow[];
}

async function fetchSpansByTraceIds(traceIds: string[]): Promise<PhoenixSpanRow[]> {
  if (traceIds.length === 0) return [];

  const client = createPremortemPhoenixClient();
  const result = await getSpans({
    client,
    project: { projectName: resolvePhoenixProjectName() },
    traceIds,
    limit: MAX_SEMANTIC_NODES
  });
  return result.spans as PhoenixSpanRow[];
}

async function fetchCandidateAuditSpans(startTime?: Date, endTime?: Date): Promise<PhoenixSpanRow[]> {
  const client = createPremortemPhoenixClient();
  const result = await getSpans({
    client,
    project: { projectName: resolvePhoenixProjectName() },
    name: [...AUDIT_SPAN_NAMES],
    startTime,
    endTime,
    limit: MAX_SEMANTIC_NODES
  });
  return result.spans as PhoenixSpanRow[];
}

function buildGraphFromSpans(spans: PhoenixSpanRow[]): Pick<
  PhoenixSemanticGraphPayload,
  'nodes' | 'edges' | 'traceIds'
> {
  const trimmed = spans.filter((span) => !isNoiseHttpSpan(span)).slice(0, MAX_SEMANTIC_NODES);
  const spanIds = new Set(trimmed.map((span) => span.id));

  const nodes: PhoenixSemanticGraphNode[] = trimmed.map((span) => ({
    id: spanNodeId(span.id),
    label: spanLabel(span),
    kind: normalizeSpanKind(span),
    spanKind: span.span_kind ?? undefined,
    status: span.status_code ?? undefined
  }));

  const edges: PhoenixSemanticGraphEdge[] = [];
  for (const span of trimmed) {
    const parentId = span.parent_id?.trim();
    if (!parentId || !spanIds.has(parentId)) continue;
    if (edges.length >= MAX_SEMANTIC_EDGES) break;
    edges.push({
      from: spanNodeId(parentId),
      to: spanNodeId(span.id),
      type: 'child'
    });
  }

  return {
    nodes,
    edges,
    traceIds: collectTraceIds(trimmed)
  };
}

export async function fetchPhoenixSemanticGraphForAudit(input: {
  auditRunId: string;
  startedAt?: string | Date | null;
  completedAt?: string | Date | null;
}): Promise<PhoenixSemanticGraphPayload> {
  const emptyPayload = (source: PhoenixSemanticGraphPayload['source']): PhoenixSemanticGraphPayload => ({
    configured: isPhoenixClientConfigured(),
    auditRunId: input.auditRunId,
    traceIds: [],
    nodes: [],
    edges: [],
    source
  });

  if (!isPhoenixClientConfigured()) {
    return emptyPayload('unconfigured');
  }

  const startTime = input.startedAt ? new Date(input.startedAt) : undefined;
  const endTime = input.completedAt ? new Date(input.completedAt) : undefined;
  if (endTime) {
    endTime.setMinutes(endTime.getMinutes() + 15);
  }

  let matchedSpans: PhoenixSpanRow[] = [];

  try {
    matchedSpans = await fetchSpansByAuditAttribute(input.auditRunId, startTime, endTime);
  } catch {
    matchedSpans = [];
  }

  if (matchedSpans.length === 0) {
    try {
      const candidates = await fetchCandidateAuditSpans(startTime, endTime);
      matchedSpans = candidates.filter((span) => attributeMatchesAuditRun(span, input.auditRunId));
    } catch {
      matchedSpans = [];
    }
  }

  if (matchedSpans.length === 0) {
    return emptyPayload('empty');
  }

  let spans = matchedSpans;
  const traceIds = collectTraceIds(matchedSpans);

  if (traceIds.length > 0) {
    try {
      const traceSpans = await fetchSpansByTraceIds(traceIds);
      if (traceSpans.length > matchedSpans.length) {
        spans = traceSpans;
      }
    } catch {
      spans = matchedSpans;
    }
  }

  const graph = buildGraphFromSpans(spans);
  if (graph.nodes.length === 0) {
    return emptyPayload('empty');
  }

  return {
    configured: true,
    auditRunId: input.auditRunId,
    traceIds: graph.traceIds,
    nodes: graph.nodes,
    edges: graph.edges,
    source: 'phoenix'
  };
}
