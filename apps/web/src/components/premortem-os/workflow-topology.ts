import type { EvidenceRefLike } from '@premortem/domain';
import { isLikelyRepositoryFilePath, parseFileEvidenceRef } from '@premortem/domain';

import type { Finding } from '@/lib/premortem-os/types';

import type { WorkflowGraphEdge, WorkflowGraphNode } from './workflow-graph.types';

function normalizeCandidate(value: string): string {
  return value.trim().replace(/\\/g, '/').replace(/^\.\//, '').replace(/\/+$/, '');
}

function collectGraphPathCandidates(node: WorkflowGraphNode): string[] {
  const props = node.props ?? {};
  const candidates = new Set<string>([
    node.id,
    node.label,
    typeof props.sourcePath === 'string' ? props.sourcePath : '',
    typeof props.filePath === 'string' ? props.filePath : '',
    typeof props.filepath === 'string' ? props.filepath : '',
    typeof props.path === 'string' ? props.path : '',
    typeof props.ref === 'string' ? props.ref : '',
    typeof props.importedBy === 'string' ? props.importedBy : ''
  ]);

  if (node.id.startsWith('source:')) {
    candidates.add(node.id.slice('source:'.length));
  }
  if (node.id.startsWith('file:')) {
    candidates.add(node.id.slice('file:'.length));
  }
  if (node.id.startsWith('pipeline:')) {
    candidates.add(node.id.slice('pipeline:'.length));
  }
  if (node.id.startsWith('service:')) {
    candidates.add(node.id.slice('service:'.length));
  }
  if (node.id.startsWith('app:')) {
    candidates.add(node.id.slice('app:'.length));
  }

  return [...candidates]
    .map((candidate) => normalizeCandidate(candidate))
    .filter((candidate) => candidate.length > 0);
}

function collectFindingPathCandidates(finding: Finding): string[] {
  const candidates = new Set<string>([finding.filepath]);
  for (const ref of finding.evidenceRefs ?? []) {
    const parsed = parseFileEvidenceRef(ref.ref);
    if (parsed) {
      candidates.add(parsed.filePath);
      candidates.add(`${parsed.filePath}:${parsed.startLine}`);
    } else {
      candidates.add(ref.ref);
    }
  }
  return [...candidates]
    .map((candidate) => normalizeCandidate(candidate))
    .filter((candidate) => candidate.length > 0);
}

export function resolveGraphNodePath(node: WorkflowGraphNode): string | null {
  const candidates = collectGraphPathCandidates(node);
  const explicit = candidates.find((candidate) => isLikelyRepositoryFilePath(candidate));
  return explicit ?? candidates[0] ?? null;
}

export function matchGraphNodeIdsForFinding(
  finding: Finding,
  nodes: WorkflowGraphNode[]
): string[] {
  const findingCandidates = collectFindingPathCandidates(finding);
  if (findingCandidates.length === 0) return [];

  return nodes
    .filter((node) => {
      const graphCandidates = collectGraphPathCandidates(node);
      return graphCandidates.some((graphCandidate) =>
        findingCandidates.some((findingCandidate) => {
          if (graphCandidate === findingCandidate) return true;
          if (graphCandidate.endsWith(`/${findingCandidate}`)) return true;
          if (findingCandidate.endsWith(`/${graphCandidate}`)) return true;
          return false;
        })
      );
    })
    .map((node) => node.id);
}

export function matchGraphEdgeIdsForNodeIds(edges: WorkflowGraphEdge[], nodeIds: Iterable<string>): string[] {
  const nodeIdSet = new Set(nodeIds);
  return edges
    .filter((edge) => nodeIdSet.has(edge.from) || nodeIdSet.has(edge.to))
    .map((edge) => edge.id);
}

export function buildFindingPathFilterPredicate(path: string) {
  const target = normalizeCandidate(path);
  return (finding: Finding) => {
    if (!target) return true;
    if (normalizeCandidate(finding.filepath) === target) return true;
    return (finding.evidenceRefs ?? []).some((ref: EvidenceRefLike) => {
      const parsed = parseFileEvidenceRef(ref.ref);
      if (!parsed) {
        return normalizeCandidate(ref.ref) === target;
      }
      return (
        normalizeCandidate(parsed.filePath) === target ||
        normalizeCandidate(`${parsed.filePath}:${parsed.startLine}`) === target
      );
    });
  };
}

