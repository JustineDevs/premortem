import type { AuditRun, Project, RiskCluster } from '@/lib/premortem-os/types';

import { fetchRuntimeAuditSnapshot, type RuntimeApiHeaders } from './client';
import { mapAuditListItemToAuditRun, mapSnapshotToAuditRun, mapSnapshotsToRiskClusters } from './map-runtime-to-console';

export async function hydrateAuditRunsFromSnapshots(
  audits: AuditRun[],
  projectNameById: Map<string, string>,
  limit = 12,
  actorHeaders?: RuntimeApiHeaders
): Promise<{ audits: AuditRun[]; riskClusters: RiskCluster[] }> {
  const toHydrate = audits.slice(0, limit);
  const snapshots = await Promise.all(
    toHydrate.map((audit) =>
      fetchRuntimeAuditSnapshot(audit.id, actorHeaders).catch(() => null)
    )
  );

  const snapshotByAuditId = new Map<string, NonNullable<(typeof snapshots)[number]>>();
  for (let index = 0; index < toHydrate.length; index += 1) {
    const snapshot = snapshots[index];
    if (snapshot) {
      snapshotByAuditId.set(toHydrate[index]!.id, snapshot);
    }
  }

  const hydratedAudits = audits.map((audit) => {
    const snapshot = snapshotByAuditId.get(audit.id);
    if (!snapshot) return audit;
    return mapSnapshotToAuditRun(snapshot, projectNameById.get(audit.projectId) ?? audit.projectName);
  });

  const riskClusters = mapSnapshotsToRiskClusters(
    [...snapshotByAuditId.values()]
  );

  return { audits: hydratedAudits, riskClusters };
}

export function projectNameMapFromProjects(projects: Project[]): Map<string, string> {
  return new Map(projects.map((project) => [project.id, project.name] as const));
}

export { mapAuditListItemToAuditRun };
