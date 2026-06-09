import type { CanonicalFinding } from '@premortem/agent-kit';

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
}

export function clusterFindings(findings: CanonicalFinding[]): RuntimeCluster[] {
  const grouped = new Map<string, CanonicalFinding[]>();

  for (const finding of findings) {
    const asset = finding.affected_assets[0] ?? 'unknown';
    const key = `${finding.category}:${finding.finding_type}:${asset}`;
    grouped.set(key, [...(grouped.get(key) ?? []), finding]);
  }

  return [...grouped.entries()].map(([clusterKey, items]) => ({
    clusterKey,
    categoryOwner: items[0]?.category ?? 'unknown',
    titleHint: items[0]?.predicted_failure.summary ?? clusterKey,
    severity: items.some((item) => item.severity === 'high') ? 'high' : items[0]?.severity ?? 'medium',
    confidence: Math.max(...items.map((item) => item.confidence)),
    blastRadius: items[0]?.predicted_failure.blast_radius,
    assetScope: [...new Set(items.flatMap((item) => item.affected_assets))],
    triggerSignature: [...new Set(items.flatMap((item) => item.predicted_failure.trigger_conditions))],
    sourceFindingIds: items.map((item) => item.finding_id)
  }));
}
