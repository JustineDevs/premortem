import type { GraphSnapshotPayload } from '@premortem/graph-model';
import { readGraphSnapshotFromNeo4j } from '@premortem/integrations';

import { buildGraphFromIngestion } from './build-graph-snapshot';
import { EMPTY_CI_HISTORY } from '../ingestion/ingest-project';

type GraphMetadata = Record<string, unknown> | null | undefined;

function isGraphPayload(value: unknown): value is GraphSnapshotPayload {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as GraphSnapshotPayload;
  return Array.isArray(candidate.nodes) && Array.isArray(candidate.edges);
}

/** Rebuild a graph from snapshot metadata when inline/storage payload is unavailable. */
export function rebuildGraphFromSnapshotMetadata(input: {
  auditRunId: string;
  projectId: string;
  metadata: GraphMetadata;
}): GraphSnapshotPayload | null {
  const metadata = input.metadata;
  if (!metadata) return null;

  const inlinePayload = metadata.inlinePayload;
  if (isGraphPayload(inlinePayload)) {
    return inlinePayload;
  }

  const apps = Array.isArray(metadata.apps)
    ? metadata.apps.filter((entry): entry is string => typeof entry === 'string')
    : [];
  const services = Array.isArray(metadata.services)
    ? metadata.services.filter((entry): entry is string => typeof entry === 'string')
    : [];

  if (apps.length === 0 && services.length === 0) {
    return null;
  }

  return buildGraphFromIngestion({
    auditRunId: input.auditRunId,
    projectId: input.projectId,
    bundle: {
      repoRoot: String(metadata.repoRoot ?? input.projectId),
      branch: String(metadata.branch ?? 'main'),
      commitSha: typeof metadata.commitSha === 'string' ? metadata.commitSha : undefined,
      repo_tree: [],
      ci_config: {},
      has_ci: Boolean(metadata.hasCi),
      package_manifests: [],
      pipeline_files: [],
      apps,
      services,
      ci_history: EMPTY_CI_HISTORY,
      existing_issues: [],
      metadata: {}
    }
  });
}

export async function resolveGraphSnapshotPayload(input: {
  auditRunId: string;
  projectId: string;
  storageRef?: string | null;
  metadata: GraphMetadata;
  payload?: unknown;
  download: (storageRef: string) => Promise<unknown | null>;
}): Promise<GraphSnapshotPayload | null> {
  if (isGraphPayload(input.payload)) {
    return input.payload;
  }

  if (input.storageRef?.startsWith('neo4j://')) {
    try {
      const fromNeo4j = await readGraphSnapshotFromNeo4j(input.auditRunId);
      if (isGraphPayload(fromNeo4j)) {
        return fromNeo4j;
      }
    } catch {
      // fall through to storage/metadata rebuild
    }
  }

  if (input.storageRef?.startsWith('supabase://')) {
    try {
      const downloaded = await input.download(input.storageRef);
      if (isGraphPayload(downloaded)) {
        return downloaded;
      }
    } catch {
      // fall through to metadata rebuild
    }
  }

  return rebuildGraphFromSnapshotMetadata({
    auditRunId: input.auditRunId,
    projectId: input.projectId,
    metadata: input.metadata
  });
}
