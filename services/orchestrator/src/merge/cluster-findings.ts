import type { CanonicalFinding } from '@premortem/agent-kit';
import type { DedupePolicy } from '@premortem/agent-kit';

export interface RuntimeCluster {
  clusterKey: string;
  categoryOwner: string;
  titleHint: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  confidence: number;
  blastRadius?: string;
  assetScope: string[];
  triggerSignature: string[];
  sourceFindingIds: string[];
  primaryFindingId: string;
}

const SEVERITY_RANK: Record<RuntimeCluster['severity'], number> = {
  low: 0,
  medium: 1,
  high: 2,
  critical: 3
};

function normalizeToken(value: string): string {
  return value.trim().toLowerCase();
}

function overlapRatio(left: string[], right: string[]) {
  const leftSet = new Set(left.map(normalizeToken));
  const rightSet = new Set(right.map(normalizeToken));
  let overlap = 0;
  for (const value of leftSet) {
    if (rightSet.has(value)) overlap += 1;
  }
  const denom = Math.max(leftSet.size, rightSet.size, 1);
  return overlap / denom;
}

function evidenceOverlapRatio(a: CanonicalFinding, b: CanonicalFinding) {
  const left = new Set(a.evidence.map((item) => normalizeToken(`${item.kind}:${item.ref}:${item.reason}`)));
  const right = new Set(b.evidence.map((item) => normalizeToken(`${item.kind}:${item.ref}:${item.reason}`)));
  let overlap = 0;
  for (const value of left) {
    if (right.has(value)) overlap += 1;
  }
  return overlap / Math.max(left.size, right.size, 1);
}

function findingsOverlap(a: CanonicalFinding, b: CanonicalFinding, policy: DedupePolicy['finding_level']) {
  if (a.category !== b.category) {
    return false;
  }

  const score =
    (a.finding_type === b.finding_type ? policy.same_finding_type_weight : 0) +
    overlapRatio(a.affected_assets, b.affected_assets) * policy.same_asset_weight +
    (a.predicted_failure.failure_mode &&
    b.predicted_failure.failure_mode &&
    normalizeToken(a.predicted_failure.failure_mode) === normalizeToken(b.predicted_failure.failure_mode)
      ? policy.same_failure_mode_weight
      : 0) +
    evidenceOverlapRatio(a, b) * policy.evidence_overlap_weight +
    overlapRatio(a.dedupe_keys, b.dedupe_keys) * policy.dedupe_key_overlap_weight;

  return score >= policy.threshold;
}

export function clusterFindings(
  findings: CanonicalFinding[],
  dedupePolicy?: DedupePolicy
): RuntimeCluster[] {
  if (findings.length === 0) return [];

  const policy = dedupePolicy?.finding_level ?? {
    same_finding_type_weight: 0.25,
    same_asset_weight: 0.25,
    same_failure_mode_weight: 0.2,
    evidence_overlap_weight: 0.15,
    dedupe_key_overlap_weight: 0.15,
    threshold: 0.7
  };

  const unionFind = new UnionFind(findings.length);
  for (let i = 0; i < findings.length; i += 1) {
    for (let j = i + 1; j < findings.length; j += 1) {
      if (findingsOverlap(findings[i]!, findings[j]!, policy)) {
        unionFind.union(i, j);
      }
    }
  }

  const grouped = new Map<number, CanonicalFinding[]>();
  for (let index = 0; index < findings.length; index += 1) {
    const root = unionFind.find(index);
    grouped.set(root, [...(grouped.get(root) ?? []), findings[index]!]);
  }

  return [...grouped.values()].map((items) => {
    const primary = pickPrimaryFinding(items);
    const orderedIds = [
      primary.finding_id,
      ...items.filter((item) => item.finding_id !== primary.finding_id).map((item) => item.finding_id)
    ];

    return {
      clusterKey: buildClusterKey(primary, items),
      categoryOwner: primary.category,
      titleHint: primary.predicted_failure.summary,
      severity: items.some((item) => item.severity === 'high' || item.severity === 'critical')
        ? items.some((item) => item.severity === 'critical')
          ? 'critical'
          : 'high'
        : primary.severity,
      confidence: Math.max(...items.map((item) => item.confidence)),
      blastRadius: primary.predicted_failure.blast_radius,
      assetScope: [...new Set(items.flatMap((item) => item.affected_assets))],
      triggerSignature: [...new Set(items.flatMap((item) => item.predicted_failure.trigger_conditions))],
      sourceFindingIds: orderedIds,
      primaryFindingId: primary.finding_id
    };
  });
}

class UnionFind {
  private readonly parent: number[];

  constructor(size: number) {
    this.parent = Array.from({ length: size }, (_, index) => index);
  }

  find(index: number): number {
    if (this.parent[index] !== index) {
      this.parent[index] = this.find(this.parent[index]!);
    }
    return this.parent[index]!;
  }

  union(a: number, b: number): void {
    const rootA = this.find(a);
    const rootB = this.find(b);
    if (rootA !== rootB) {
      this.parent[rootB] = rootA;
    }
  }
}

function pickPrimaryFinding(items: CanonicalFinding[]): CanonicalFinding {
  return [...items].sort((left, right) => {
    const severityDelta = SEVERITY_RANK[right.severity] - SEVERITY_RANK[left.severity];
    if (severityDelta !== 0) return severityDelta;
    return right.confidence - left.confidence;
  })[0]!;
}

function buildClusterKey(primary: CanonicalFinding, items: CanonicalFinding[]): string {
  const asset = primary.affected_assets[0] ?? 'unknown';
  const dedupeHint = primary.dedupe_keys[0] ?? primary.finding_type;
  return `${primary.category}:${primary.finding_type}:${normalizeToken(asset)}:${normalizeToken(dedupeHint)}:${items.length}`;
}
