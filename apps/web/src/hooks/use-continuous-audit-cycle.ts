'use client';

import { useEffect } from 'react';

import type { AuditRun, Project } from '@/lib/premortem-os/types';

/** Status poll cadence for continuous audit runtime (2s). */
const STATUS_POLL_MS = 2000;
/** Workspace refresh cadence while continuous audit is enabled (30s). */
const WORKSPACE_REFRESH_MS = 30_000;

interface UseContinuousAuditCycleOptions {
  enabled: boolean;
  projects: Project[];
  audits: AuditRun[];
  onTriggerScan: (projectId: string) => void | Promise<void>;
  refetchAudits: () => void | Promise<unknown>;
  refetchWorkspace: () => void | Promise<unknown>;
}

export function useContinuousAuditCycle({
  enabled,
  audits,
  refetchAudits,
  refetchWorkspace
}: UseContinuousAuditCycleOptions) {
  const hasRunningAudit = audits.some(
    (audit) => audit.status === 'RUNNING' || audit.status === 'PAUSED'
  );
  const pipelineActive = enabled && hasRunningAudit;

  useEffect(() => {
    if (!enabled) return;

    const poll = window.setInterval(() => {
      void refetchAudits();
    }, STATUS_POLL_MS);

    return () => window.clearInterval(poll);
  }, [enabled, refetchAudits]);

  useEffect(() => {
    if (!enabled) return;

    const poll = window.setInterval(() => {
      void refetchWorkspace();
    }, WORKSPACE_REFRESH_MS);

    return () => window.clearInterval(poll);
  }, [enabled, refetchWorkspace]);

  return { pipelineActive };
}
