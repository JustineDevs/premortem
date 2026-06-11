import type { GraphSnapshotPayload } from '@premortem/graph-model';

import { createNeo4jConfig, createNeo4jDriver } from './neo4j';

export function isNeo4jGraphEnabled(): boolean {
  if (process.env.NEO4J_DISABLED === '1') return false;
  return Boolean(process.env.NEO4J_URI ?? createNeo4jConfig().uri);
}

function serializeProps(props: Record<string, unknown> | undefined): string {
  return JSON.stringify(props ?? {});
}

function deserializeProps(value: unknown): Record<string, unknown> | undefined {
  if (typeof value !== 'string' || value.length === 0) return undefined;
  try {
    const parsed = JSON.parse(value) as unknown;
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : undefined;
  } catch {
    return undefined;
  }
}

/** Persist an audit graph snapshot in Neo4j (ACID transaction, audit-scoped nodes). */
export async function writeGraphSnapshotToNeo4j(snapshot: GraphSnapshotPayload): Promise<void> {
  const driver = createNeo4jDriver();
  const session = driver.session();

  const nodes = snapshot.nodes.map((node) => ({
    id: node.id,
    label: node.label,
    kind: node.kind,
    propsJson: serializeProps(node.props)
  }));

  const edges = snapshot.edges.map((edge) => ({
    from: edge.from,
    to: edge.to,
    type: edge.type,
    propsJson: serializeProps(edge.props)
  }));

  try {
    await session.executeWrite(async (tx) => {
      await tx.run(
        `
        MATCH (a:AuditRun {id: $auditRunId})-[:HAS_NODE]->(n:GraphNode)
        DETACH DELETE n
        `,
        { auditRunId: snapshot.auditRunId }
      );

      await tx.run(
        `
        MERGE (a:AuditRun {id: $auditRunId})
        SET a.projectId = $projectId, a.updatedAt = datetime()
        `,
        { auditRunId: snapshot.auditRunId, projectId: snapshot.projectId }
      );

      if (nodes.length > 0) {
        await tx.run(
          `
          UNWIND $nodes AS node
          MERGE (n:GraphNode {auditRunId: $auditRunId, id: node.id})
          SET n.label = node.label, n.kind = node.kind, n.propsJson = node.propsJson
          WITH n
          MATCH (a:AuditRun {id: $auditRunId})
          MERGE (a)-[:HAS_NODE]->(n)
          `,
          { auditRunId: snapshot.auditRunId, nodes }
        );
      }

      if (edges.length > 0) {
        await tx.run(
          `
          UNWIND $edges AS edge
          MATCH (f:GraphNode {auditRunId: $auditRunId, id: edge.from})
          MATCH (t:GraphNode {auditRunId: $auditRunId, id: edge.to})
          MERGE (f)-[r:RELATES_TO {type: edge.type}]->(t)
          SET r.propsJson = edge.propsJson
          `,
          { auditRunId: snapshot.auditRunId, edges }
        );
      }
    });
  } finally {
    await session.close();
    await driver.close();
  }
}

/** Load an audit graph snapshot from Neo4j. Returns null when the audit run has no graph. */
export async function readGraphSnapshotFromNeo4j(auditRunId: string): Promise<GraphSnapshotPayload | null> {
  const driver = createNeo4jDriver();
  const session = driver.session();

  try {
    const auditResult = await session.executeRead((tx) =>
      tx.run(
        `
        MATCH (a:AuditRun {id: $auditRunId})
        RETURN a.projectId AS projectId
        `,
        { auditRunId }
      )
    );

    if (auditResult.records.length === 0) {
      return null;
    }

    const projectId = String(auditResult.records[0].get('projectId') ?? '');

    const nodeResult = await session.executeRead((tx) =>
      tx.run(
        `
        MATCH (:AuditRun {id: $auditRunId})-[:HAS_NODE]->(n:GraphNode)
        RETURN n.id AS id, n.label AS label, n.kind AS kind, n.propsJson AS propsJson
        ORDER BY n.id
        `,
        { auditRunId }
      )
    );

    if (nodeResult.records.length === 0) {
      return null;
    }

    const edgeResult = await session.executeRead((tx) =>
      tx.run(
        `
        MATCH (:AuditRun {id: $auditRunId})-[:HAS_NODE]->(f:GraphNode)-[r:RELATES_TO]->(t:GraphNode)
        WHERE t.auditRunId = $auditRunId
        RETURN f.id AS from, t.id AS to, r.type AS type, r.propsJson AS propsJson
        ORDER BY f.id, t.id, r.type
        `,
        { auditRunId }
      )
    );

    return {
      auditRunId,
      projectId,
      nodes: nodeResult.records.map((record) => ({
        id: String(record.get('id')),
        label: String(record.get('label')),
        kind: String(record.get('kind')) as GraphSnapshotPayload['nodes'][number]['kind'],
        props: deserializeProps(record.get('propsJson'))
      })),
      edges: edgeResult.records.map((record) => ({
        from: String(record.get('from')),
        to: String(record.get('to')),
        type: String(record.get('type')),
        props: deserializeProps(record.get('propsJson'))
      }))
    };
  } finally {
    await session.close();
    await driver.close();
  }
}
