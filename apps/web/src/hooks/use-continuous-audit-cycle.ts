'use client';

import { useEffect } from 'react';

import type { AuditRun, Project } from '@/lib/premortem-os/types';

/** Status poll cadence for continuous audit runtime (2s). */
const STATUS_POLL_MS = 2000;

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
      void refetchWorkspace();
    }, STATUS_POLL_MS);

    return () => window.clearInterval(poll);
  }, [enabled, refetchAudits, refetchWorkspace]);

  return { pipelineActive };
}
