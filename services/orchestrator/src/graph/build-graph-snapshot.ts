import path from 'node:path';
import type { GraphSnapshotPayload } from '@premortem/graph-model';
import type { IngestionBundle } from '../ingestion/ingest-project';

const SOURCE_EXTENSIONS = ['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs', '.mts', '.cts'];
const IMPORT_PATTERN =
  /(?:import|export)\s+(?:type\s+)?(?:[^'"]*?\sfrom\s+)?['"]([^'"]+)['"]|require\(\s*['"]([^'"]+)['"]\s*\)/g;

function normalizePath(value: string) {
  return path.posix.normalize(value.replace(/\\/g, '/')).replace(/^\.\//, '');
}

function candidateModulePaths(specifier: string) {
  const normalized = normalizePath(specifier);
  const baseCandidates = [normalized];

  if (SOURCE_EXTENSIONS.some((extension) => normalized.endsWith(extension))) {
    return baseCandidates;
  }

  return [
    ...baseCandidates,
    ...SOURCE_EXTENSIONS.map((extension) => `${normalized}${extension}`),
    ...SOURCE_EXTENSIONS.map((extension) => `${normalized}/index${extension}`)
  ];
}

function resolveRelativeImport(fromPath: string, specifier: string, availablePaths: Set<string>) {
  if (!specifier.startsWith('.')) return null;

  const fromDir = fromPath.includes('/') ? fromPath.slice(0, fromPath.lastIndexOf('/')) : '';
  const joined = normalizePath(`${fromDir}/${specifier}`);
  for (const candidate of candidateModulePaths(joined)) {
    if (availablePaths.has(candidate)) return candidate;
  }
  return null;
}

function extractImports(content: string) {
  const imports = new Set<string>();
  for (const match of content.matchAll(IMPORT_PATTERN)) {
    const specifier = match[1] ?? match[2];
    if (specifier) imports.add(specifier);
  }
  return [...imports];
}

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
  const seenEdges = new Set<string>();
  const availablePaths = new Set(input.bundle.repo_tree.map((entry) => normalizePath(entry)));

  const addEdge = (from: string, to: string, type: string, props?: Record<string, unknown>) => {
    const key = `${from}->${to}:${type}`;
    if (seenEdges.has(key)) return;
    seenEdges.add(key);
    edges.push({ from, to, type, props });
  };

  for (const manifest of input.bundle.package_manifests) {
    const nodeId = `file:${manifest}`;
    nodes.push({ id: nodeId, label: manifest, kind: 'file', props: { role: 'manifest' } });
    addEdge(`repo:${input.projectId}`, nodeId, 'contains');
  }

  for (const pipeline of input.bundle.pipeline_files) {
    const nodeId = `pipeline:${pipeline}`;
    nodes.push({ id: nodeId, label: pipeline, kind: 'pipeline', props: { role: 'ci_config' } });
    addEdge(`repo:${input.projectId}`, nodeId, 'runs_in');
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
    addEdge(`repo:${input.projectId}`, nodeId, 'executed');

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
      addEdge(nodeId, jobNodeId, 'failed_with');
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
    addEdge(`repo:${input.projectId}`, nodeId, 'tracks');
  }

  for (const appName of input.bundle.apps) {
    const nodeId = `app:${appName}`;
    nodes.push({ id: nodeId, label: appName, kind: 'package', props: { layer: 'app' } });
    addEdge(`repo:${input.projectId}`, nodeId, 'owns');
  }

  for (const serviceName of input.bundle.services) {
    const nodeId = `service:${serviceName}`;
    nodes.push({ id: nodeId, label: serviceName, kind: 'service', props: { layer: 'service' } });
    addEdge(`repo:${input.projectId}`, nodeId, 'owns');
  }

  for (const source of input.bundle.source_files) {
    const history = input.bundle.git_history.find((entry) => entry.path === source.path);
    const nodeId = `source:${source.path}`;
    nodes.push({
      id: nodeId,
      label: source.path,
      kind: source.kind === 'ownership' ? 'owner' : 'file',
      props: {
        role: source.kind,
        lineCount: source.lineCount,
        preview: source.preview,
        recentCommitCount: history?.commits.length ?? 0,
        recentAuthors: history ? [...new Set(history.commits.map((commit) => commit.authorName))] : [],
        latestCommitId: history?.commits[0]?.shortId ?? null
      }
    });
    addEdge(`repo:${input.projectId}`, nodeId, 'contains');

    if (history) {
      for (const commit of history.commits.slice(0, 3)) {
        const commitNodeId = `commit:${source.path}:${commit.shortId}`;
        if (!nodes.some((node) => node.id === commitNodeId)) {
          nodes.push({
            id: commitNodeId,
            label: commit.shortId,
            kind: 'artifact',
            props: {
              title: commit.title,
              authorName: commit.authorName,
              authoredAt: commit.authoredAt,
              committedAt: commit.committedAt,
              webUrl: commit.webUrl || null
            }
          });
        }
        addEdge(nodeId, commitNodeId, 'touched_by', { authorName: commit.authorName });
      }
    }

    for (const specifier of extractImports(source.preview)) {
      const resolved = resolveRelativeImport(source.path, specifier, availablePaths);
      if (!resolved) continue;
      addEdge(nodeId, `source:${resolved}`, 'imports', { specifier });
    }
  }

  for (const hint of input.bundle.ownership_hints) {
    const ownerNodeId = `owner:${hint.owner}`;
    if (!nodes.some((node) => node.id === ownerNodeId)) {
      nodes.push({
        id: ownerNodeId,
        label: hint.owner,
        kind: 'owner',
        props: { pattern: hint.pattern, source: hint.path }
      });
    }
    addEdge(`repo:${input.projectId}`, ownerNodeId, 'has_owner_hint', {
      pattern: hint.pattern,
      source: hint.path
    });
  }

  return {
    auditRunId: input.auditRunId,
    projectId: input.projectId,
    nodes,
    edges
  };
}
