import { NextResponse } from 'next/server';

import { downloadArtifact } from '@premortem/storage';
import { getAuditRunSnapshot, resolveGraphSnapshotPayload } from '@premortem/orchestrator';

export async function GET(_request: Request, { params }: { params: { id: string } }) {
  const snapshot = await getAuditRunSnapshot(params.id);
  if (!snapshot?.graphSnapshot) {
    return NextResponse.json({ error: 'Graph snapshot not found for this audit run' }, { status: 404 });
  }

  const graphSnapshot = snapshot.graphSnapshot;
  const payload = await resolveGraphSnapshotPayload({
    auditRunId: params.id,
    projectId: snapshot.projectId,
    storageRef: graphSnapshot.storageRef,
    metadata: graphSnapshot.metadata as Record<string, unknown>,
    payload: graphSnapshot.payload,
    download: downloadArtifact
  });

  if (!payload) {
    return NextResponse.json(
      { error: 'Graph artifact payload unavailable for this audit run' },
      { status: 404 }
    );
  }

  return NextResponse.json({
    auditRunId: params.id,
    storageRef: graphSnapshot.storageRef,
    nodeCount: graphSnapshot.nodeCount,
    edgeCount: graphSnapshot.edgeCount,
    payload,
    source: graphSnapshot.storageRef?.startsWith('neo4j://')
      ? 'neo4j'
      : graphSnapshot.storageRef?.startsWith('supabase://')
        ? 'storage'
        : 'inline-or-metadata'
  });
}
