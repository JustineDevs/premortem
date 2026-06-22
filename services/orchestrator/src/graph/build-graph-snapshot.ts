import path from 'node:path';
import ts from 'typescript';
import type { GraphSnapshotPayload } from '@premortem/graph-model';
import type { IngestionBundle } from '../ingestion/ingest-project';

const SOURCE_EXTENSIONS = ['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs', '.mts', '.cts'];

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
  const sourceFile = ts.createSourceFile(
    'preview.ts',
    content,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TS
  );

  const visit = (node: ts.Node) => {
    if (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) {
      const moduleSpecifier = node.moduleSpecifier;
      if (moduleSpecifier && ts.isStringLiteralLike(moduleSpecifier)) {
        imports.add(moduleSpecifier.text);
      }
    }

    if (
      ts.isCallExpression(node) &&
      ts.isIdentifier(node.expression) &&
      node.expression.text === 'require' &&
      node.arguments.length > 0
    ) {
      const first = node.arguments[0];
      if (ts.isStringLiteralLike(first)) {
        imports.add(first.text);
      }
    }

    ts.forEachChild(node, visit);
  };

  visit(sourceFile);
  return [...imports];
}

function scriptKindForPath(filePath: string): ts.ScriptKind {
  if (filePath.endsWith('.tsx')) return ts.ScriptKind.TSX;
  if (filePath.endsWith('.jsx')) return ts.ScriptKind.JSX;
  return ts.ScriptKind.TS;
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

function lineNumberAt(sourceFile: ts.SourceFile, position: number) {
  return sourceFile.getLineAndCharacterOfPosition(position).line + 1;
}

function extractSourceSymbols(filePath: string, content: string): {
  imports: string[];
  symbols: SourceSymbol[];
} {
  const sourceFile = ts.createSourceFile(
    filePath,
    content,
    ts.ScriptTarget.Latest,
    true,
    scriptKindForPath(filePath)
  );

  const imports = extractImports(content);
  const symbols: SourceSymbol[] = [];

  const exported = (node: ts.Node) =>
    Boolean(
      ts.canHaveModifiers(node) &&
        ts.getModifiers(node)?.some((modifier) => modifier.kind === ts.SyntaxKind.ExportKeyword)
    );

  for (const statement of sourceFile.statements) {
    if (ts.isFunctionDeclaration(statement) && statement.name) {
      symbols.push({
        name: statement.name.text,
        kind: 'function',
        exported: exported(statement),
        startLine: lineNumberAt(sourceFile, statement.getStart(sourceFile)),
        endLine: lineNumberAt(sourceFile, statement.getEnd())
      });
      continue;
    }

    if (ts.isClassDeclaration(statement) && statement.name) {
      symbols.push({
        name: statement.name.text,
        kind: 'class',
        exported: exported(statement),
        startLine: lineNumberAt(sourceFile, statement.getStart(sourceFile)),
        endLine: lineNumberAt(sourceFile, statement.getEnd())
      });
      continue;
    }

    if (ts.isInterfaceDeclaration(statement)) {
      symbols.push({
        name: statement.name.text,
        kind: 'interface',
        exported: exported(statement),
        startLine: lineNumberAt(sourceFile, statement.getStart(sourceFile)),
        endLine: lineNumberAt(sourceFile, statement.getEnd())
      });
      continue;
    }

    if (ts.isTypeAliasDeclaration(statement)) {
      symbols.push({
        name: statement.name.text,
        kind: 'type',
        exported: exported(statement),
        startLine: lineNumberAt(sourceFile, statement.getStart(sourceFile)),
        endLine: lineNumberAt(sourceFile, statement.getEnd())
      });
      continue;
    }

    if (ts.isEnumDeclaration(statement)) {
      symbols.push({
        name: statement.name.text,
        kind: 'enum',
        exported: exported(statement),
        startLine: lineNumberAt(sourceFile, statement.getStart(sourceFile)),
        endLine: lineNumberAt(sourceFile, statement.getEnd())
      });
      continue;
    }

    if (ts.isVariableStatement(statement)) {
      for (const declaration of statement.declarationList.declarations) {
        if (!ts.isIdentifier(declaration.name)) continue;

        const initializer = declaration.initializer;
        const initializerKind =
          initializer && ts.isArrowFunction(initializer)
            ? 'function'
            : initializer && ts.isFunctionExpression(initializer)
              ? 'function'
              : initializer && ts.isClassExpression(initializer)
                ? 'class'
                : 'variable';

        symbols.push({
          name: declaration.name.text,
          kind: initializerKind,
          exported: exported(statement),
          startLine: lineNumberAt(sourceFile, declaration.getStart(sourceFile)),
          endLine: lineNumberAt(sourceFile, declaration.getEnd())
        });
      }
      continue;
    }

    if (ts.isExportAssignment(statement)) {
      symbols.push({
        name: 'default',
        kind: 'default-export',
        exported: true,
        startLine: lineNumberAt(sourceFile, statement.getStart(sourceFile)),
        endLine: lineNumberAt(sourceFile, statement.getEnd())
      });
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
    const sourceGraph = isParseableSourcePreview(source.path)
      ? extractSourceSymbols(source.path, source.preview)
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
