import type { GraphSnapshotPayload } from '@premortem/graph-model';
import type { IngestionBundle } from '../ingestion/ingest-project';

export function buildGraphFromIngestion(input: {
  auditRunId: string;
  projectId: string;
  bundle: IngestionBundle;
}): GraphSnapshotPayload {
  const nodes: GraphSnapshotPayload['nodes'] = [
    {
      id: `repo:${input.projectId}`,
      label: input.bundle.repoRoot,
      kind: 'repo',
      props: { branch: input.bundle.branch, commitSha: input.bundle.commitSha ?? null }
    }
  ];
  const edges: GraphSnapshotPayload['edges'] = [];

  for (const manifest of input.bundle.package_manifests) {
    const nodeId = `file:${manifest}`;
    nodes.push({ id: nodeId, label: manifest, kind: 'file', props: { role: 'manifest' } });
    edges.push({ from: `repo:${input.projectId}`, to: nodeId, type: 'contains' });
  }

  for (const pipeline of input.bundle.pipeline_files) {
    const nodeId = `pipeline:${pipeline}`;
    nodes.push({ id: nodeId, label: pipeline, kind: 'pipeline', props: { role: 'ci_config' } });
    edges.push({ from: `repo:${input.projectId}`, to: nodeId, type: 'runs_in' });
  }

  for (const pipeline of input.bundle.ci_history.pipelines) {
    const nodeId = `pipeline-run:${pipeline.id}`;
    nodes.push({
      id: nodeId,
      label: `Pipeline #${pipeline.id}`,
      kind: 'pipeline_run',
      props: {
        status: pipeline.status,
        ref: pipeline.ref,
        sha: pipeline.sha,
        webUrl: pipeline.webUrl,
        createdAt: pipeline.createdAt,
        failedJobCount: pipeline.failedJobs.length
      }
    });
    edges.push({ from: `repo:${input.projectId}`, to: nodeId, type: 'executed' });

    for (const job of pipeline.failedJobs) {
      const jobNodeId = `ci-job:${pipeline.id}:${job.id}`;
      nodes.push({
        id: jobNodeId,
        label: job.name,
        kind: 'ci_job',
        props: {
          stage: job.stage,
          status: job.status,
          webUrl: job.webUrl,
          failureReason: job.failureReason
        }
      });
      edges.push({ from: nodeId, to: jobNodeId, type: 'failed_with' });
    }
  }

  for (const issue of input.bundle.existing_issues.slice(0, 20)) {
    const nodeId = `gitlab-issue:${issue.iid}`;
    nodes.push({
      id: nodeId,
      label: `#${issue.iid} ${issue.title}`,
      kind: 'issue',
      props: {
        state: issue.state,
        labels: issue.labels,
        webUrl: issue.webUrl,
        updatedAt: issue.updatedAt
      }
    });
    edges.push({ from: `repo:${input.projectId}`, to: nodeId, type: 'tracks' });
  }

  for (const appName of input.bundle.apps) {
    const nodeId = `app:${appName}`;
    nodes.push({ id: nodeId, label: appName, kind: 'package', props: { layer: 'app' } });
    edges.push({ from: `repo:${input.projectId}`, to: nodeId, type: 'owns' });
  }

  for (const serviceName of input.bundle.services) {
    const nodeId = `service:${serviceName}`;
    nodes.push({ id: nodeId, label: serviceName, kind: 'service', props: { layer: 'service' } });
    edges.push({ from: `repo:${input.projectId}`, to: nodeId, type: 'owns' });
  }

  return {
    auditRunId: input.auditRunId,
    projectId: input.projectId,
    nodes,
    edges
  };
}
