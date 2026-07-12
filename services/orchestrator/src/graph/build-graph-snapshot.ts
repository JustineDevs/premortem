import path from 'node:path';
import type { GraphSnapshotPayload } from '@premortem/graph-model';
import type { IngestionBundle } from '../ingestion/ingest-project';

const SOURCE_EXTENSIONS = ['.ts', '.tsx', '.js', '.jsx', '.ts', '.cjs', '.mts', '.cts'];

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
  const patterns = [
    /(?:^|\n)\s*import\s+[^'"\n]+?from\s+['"]([^'"]+)['"]/g,
    /(?:^|\n)\s*import\s+['"]([^'"]+)['"]/g,
    /(?:^|\n)\s*export\s+[^'"\n]+?from\s+['"]([^'"]+)['"]/g,
    /require\(\s*['"]([^'"]+)['"]\s*\)/g
  ];

  for (const pattern of patterns) {
    for (const match of content.matchAll(pattern)) {
      if (match[1]) imports.add(match[1]);
    }
  }

  return [...imports];
}

function isParseableSourcePreview(filePath: string) {
  return SOURCE_EXTENSIONS.some((extension) => filePath.endsWith(extension));
}

type SourceSymbol = {
  name: string;
  kind: 'function' | 'class' | 'interface' | 'type' | 'enum' | 'variable' | 'default-export';
  exported: boolean;
  startLine: number;
  endLine: number;
};

function extractSourceSymbols(content: string): {
  imports: string[];
  symbols: SourceSymbol[];
} {
  const imports = extractImports(content);
  const symbols: SourceSymbol[] = [];
  const lines = content.split(/\r?\n/);
  const pushSymbol = (
    name: string,
    kind: SourceSymbol['kind'],
    exported: boolean,
    lineIndex: number,
    endLine?: number
  ) => {
    const startLine = lineIndex + 1;
    symbols.push({
      name,
      kind,
      exported,
      startLine,
      endLine: endLine ?? startLine
    });
  };

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index]!.trim();
    const exported = /\bexport\b/.test(line);

    const functionMatch =
      line.match(/^(?:export\s+)?(?:async\s+)?function\s+([A-Za-z0-9_$]+)/) ??
      line.match(/^(?:export\s+)?const\s+([A-Za-z0-9_$]+)\s*=\s*(?:async\s*)?(?:\([^)]*\)|[A-Za-z0-9_$]+)\s*=>/);
    if (functionMatch) {
      pushSymbol(functionMatch[1]!, 'function', exported, index);
      continue;
    }

    const classMatch = line.match(/^(?:export\s+)?class\s+([A-Za-z0-9_$]+)/);
    if (classMatch) {
      pushSymbol(classMatch[1]!, 'class', exported, index);
      continue;
    }

    const interfaceMatch = line.match(/^(?:export\s+)?interface\s+([A-Za-z0-9_$]+)/);
    if (interfaceMatch) {
      pushSymbol(interfaceMatch[1]!, 'interface', exported, index);
      continue;
    }

    const typeMatch = line.match(/^(?:export\s+)?type\s+([A-Za-z0-9_$]+)/);
    if (typeMatch) {
      pushSymbol(typeMatch[1]!, 'type', exported, index);
      continue;
    }

    const enumMatch = line.match(/^(?:export\s+)?enum\s+([A-Za-z0-9_$]+)/);
    if (enumMatch) {
      pushSymbol(enumMatch[1]!, 'enum', exported, index);
      continue;
    }

    const variableMatch = line.match(
      /^(?:export\s+)?(?:const|let|var)\s+([A-Za-z0-9_$]+)\s*=\s*(.+)$/
    );
    if (variableMatch) {
      const initializer = variableMatch[2];
      const initializerKind = /=>/.test(initializer) || /\bfunction\b/.test(initializer)
        ? 'function'
        : /\bclass\b/.test(initializer)
          ? 'class'
          : 'variable';
      pushSymbol(variableMatch[1]!, initializerKind, exported, index);
      continue;
    }

    if (/^export\s+default\s+/.test(line)) {
      pushSymbol('default', 'default-export', true, index);
    }
  }

  return {
    imports,
    symbols
  };
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
  const seenNodeIds = new Set(nodes.map((node) => node.id));
  const availablePaths = new Set(input.bundle.repo_tree.map((entry) => normalizePath(entry)));

  const addEdge = (from: string, to: string, type: string, props?: Record<string, unknown>) => {
    const key = `${from}->${to}:${type}`;
    if (seenEdges.has(key)) return;
    seenEdges.add(key);
    edges.push({ from, to, type, props });
  };

  const addNode = (node: GraphSnapshotPayload['nodes'][number]) => {
    if (seenNodeIds.has(node.id)) return false;
    seenNodeIds.add(node.id);
    nodes.push(node);
    return true;
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
    nodes.push({ id: nodeId, label: appName, kind: 'app', props: { layer: 'app' } });
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
    const sourceGraph = isParseableSourcePreview(source.path)
      ? extractSourceSymbols(source.preview)
      : { imports: [] as string[], symbols: [] as SourceSymbol[] };
    nodes.push({
      id: nodeId,
      label: source.path,
      kind: source.kind === 'ownership' ? 'owner' : 'file',
      props: {
        role: source.kind,
        lineCount: source.lineCount,
        preview: source.preview,
        symbolCount: sourceGraph.symbols.length,
        importCount: sourceGraph.imports.length,
        exportedSymbolCount: sourceGraph.symbols.filter((symbol) => symbol.exported).length,
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

    for (const symbol of sourceGraph.symbols) {
      const symbolNodeId = `symbol:${source.path}:${symbol.name}`;
      nodes.push({
        id: symbolNodeId,
        label: symbol.name,
        kind: 'symbol',
        props: {
          sourcePath: source.path,
          symbolKind: symbol.kind,
          exported: symbol.exported,
          startLine: symbol.startLine,
          endLine: symbol.endLine
        }
      });
      addEdge(nodeId, symbolNodeId, symbol.exported ? 'exports' : 'declares', {
        symbolKind: symbol.kind,
        exported: symbol.exported
      });
    }

    for (const specifier of sourceGraph.imports) {
      const resolved = resolveRelativeImport(source.path, specifier, availablePaths);
      if (!resolved) continue;
      const resolvedNodeId = `source:${resolved}`;
      if (!seenNodeIds.has(resolvedNodeId)) {
        addNode({
          id: resolvedNodeId,
          label: resolved,
          kind: 'file',
          props: {
            role: 'imported_asset',
            importedBy: source.path
          }
        });
      }
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

  for (const hit of input.bundle.vulnerability_context.hits) {
    const vulnerabilityNodeId = `vuln:${hit.id}`;
    addNode({
      id: vulnerabilityNodeId,
      label: hit.id,
      kind: 'vulnerability',
      props: {
        cve: hit.cve ?? null,
        cvss: hit.cvss ?? null,
        epss: hit.epss ?? null,
        kev: hit.kev,
        summary: hit.summary,
        fixedVersion: hit.fixedVersion ?? null
      }
    });

    const packageNodeId = `pkg:${hit.package}@${hit.installedVersion}`;
    addNode({
      id: packageNodeId,
      label: `${hit.package}@${hit.installedVersion}`,
      kind: 'package',
      props: {
        ecosystem: hit.ecosystem,
        installedVersion: hit.installedVersion,
        package: hit.package
      }
    });
    addEdge(packageNodeId, vulnerabilityNodeId, 'VULNERABLE_TO');
  }

  return {
    auditRunId: input.auditRunId,
    projectId: input.projectId,
    nodes,
    edges
  };
}
