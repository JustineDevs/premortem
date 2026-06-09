import { createNeo4jDriver } from '@premortem/integrations';

export interface GraphSnapshotPayload {
  auditRunId: string;
  projectId: string;
  nodes: Array<{ id: string; label: string; props?: Record<string, unknown> }>;
  edges: Array<{ from: string; to: string; type: string; props?: Record<string, unknown> }>;
}

export async function writeGraphSnapshot(snapshot: GraphSnapshotPayload) {
  const driver = createNeo4jDriver();
  const session = driver.session();

  try {
    await session.executeWrite(async (tx) => {
      await tx.run(
        `MERGE (a:AuditRun {id: $auditRunId})
         SET a.projectId = $projectId`,
        { auditRunId: snapshot.auditRunId, projectId: snapshot.projectId }
      );

      for (const node of snapshot.nodes) {
        await tx.run(
          `MERGE (n:RepoNode {id: $id})
           SET n.label = $label, n += $props
           WITH n
           MATCH (a:AuditRun {id: $auditRunId})
           MERGE (a)-[:HAS_NODE]->(n)`,
          {
            auditRunId: snapshot.auditRunId,
            id: node.id,
            label: node.label,
            props: node.props ?? {}
          }
        );
      }

      for (const edge of snapshot.edges) {
        await tx.run(
          `MATCH (f:RepoNode {id: $from}), (t:RepoNode {id: $to})
           MERGE (f)-[r:RELATES_TO {type: $type}]->(t)
           SET r += $props`,
          {
            from: edge.from,
            to: edge.to,
            type: edge.type,
            props: edge.props ?? {}
          }
        );
      }
    });

    return {
      status: 'written',
      nodeCount: snapshot.nodes.length,
      edgeCount: snapshot.edges.length
    };
  } finally {
    await session.close();
    await driver.close();
  }
}
