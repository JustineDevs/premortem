'use client';

import { useEffect, useRef } from 'react';

import type { AuditRun, Project } from '@/lib/premortem-os/types';

/** Status poll cadence for continuous audit runtime (2s). */
const STATUS_POLL_MS = 2000;
/** Auto-scan cycle when continuous audit is locked ON (90s between idle sweeps). */
const CYCLE_SCAN_MS = 90_000;

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
  projects,
  audits,
  onTriggerScan,
  refetchAudits,
  refetchWorkspace
}: UseContinuousAuditCycleOptions) {
  const cycleIndexRef = useRef(0);
  const lastCycleAtRef = useRef(0);
  const triggeringRef = useRef(false);

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

  useEffect(() => {
    if (!enabled || projects.length === 0) return;

    const tick = window.setInterval(() => {
      if (hasRunningAudit || triggeringRef.current) return;

      const now = Date.now();
      if (now - lastCycleAtRef.current < CYCLE_SCAN_MS) return;

      const eligible = projects.filter((project) => project.status !== 'SCANNING');
      if (eligible.length === 0) return;

      const index = cycleIndexRef.current % eligible.length;
      cycleIndexRef.current += 1;
      lastCycleAtRef.current = now;

      const target = eligible[index];
      if (!target) return;

      triggeringRef.current = true;
      void Promise.resolve(onTriggerScan(target.id)).finally(() => {
        triggeringRef.current = false;
      });
    }, STATUS_POLL_MS);

    return () => window.clearInterval(tick);
  }, [enabled, projects, hasRunningAudit, onTriggerScan]);

  return { pipelineActive };
}
