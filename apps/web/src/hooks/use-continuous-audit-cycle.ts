'use client';

import { useEffect, useRef } from 'react';

import type { AuditRun, Project } from '@/lib/premortem-os/types';

/** Idle rotation cadence while continuous audit is enabled (90s). */
const ROTATION_MS = 90_000;

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
  const projectsRef = useRef(projects);
  const auditsRef = useRef(audits);
  const onTriggerScanRef = useRef(onTriggerScan);
  const refetchAuditsRef = useRef(refetchAudits);
  const refetchWorkspaceRef = useRef(refetchWorkspace);
  const triggerInFlightRef = useRef(false);

  useEffect(() => {
    projectsRef.current = projects;
  }, [projects]);

  useEffect(() => {
    auditsRef.current = audits;
  }, [audits]);

  useEffect(() => {
    onTriggerScanRef.current = onTriggerScan;
  }, [onTriggerScan]);

  useEffect(() => {
    refetchAuditsRef.current = refetchAudits;
  }, [refetchAudits]);

  useEffect(() => {
    refetchWorkspaceRef.current = refetchWorkspace;
  }, [refetchWorkspace]);

  const hasRunningAudit = audits.some(
    (audit) => audit.status === 'RUNNING' || audit.status === 'PAUSED' || audit.status === 'QUEUED'
  );
  const pipelineActive = enabled && hasRunningAudit;

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    let timer: number | undefined;

    const pickNextProjectId = () => {
      const currentProjects = projectsRef.current;
      const currentAudits = auditsRef.current;
      if (currentProjects.length === 0) return null;

      const activeProjectIds = new Set(
        currentAudits
          .filter((audit) => audit.status === 'RUNNING' || audit.status === 'PAUSED' || audit.status === 'QUEUED')
          .map((audit) => audit.projectId)
      );

      const candidates = currentProjects.filter((project) => !activeProjectIds.has(project.id));
      if (candidates.length === 0) return null;

      const auditByProject = new Map<string, string>();
      for (const audit of currentAudits) {
        const prior = auditByProject.get(audit.projectId);
        if (!prior || new Date(audit.date).getTime() > new Date(prior).getTime()) {
          auditByProject.set(audit.projectId, audit.date);
        }
      }

      return [...candidates].sort((left, right) => {
        const leftTime = auditByProject.get(left.id);
        const rightTime = auditByProject.get(right.id);
        if (!leftTime && !rightTime) return 0;
        if (!leftTime) return -1;
        if (!rightTime) return 1;
        return new Date(leftTime).getTime() - new Date(rightTime).getTime();
      })[0]?.id ?? null;
    };

    const rotate = async () => {
      if (triggerInFlightRef.current) return;
      if (
        auditsRef.current.some(
          (audit) => audit.status === 'RUNNING' || audit.status === 'PAUSED' || audit.status === 'QUEUED'
        )
      ) {
        return;
      }

      const nextProjectId = pickNextProjectId();
      if (!nextProjectId) {
        return;
      }

      triggerInFlightRef.current = true;
      try {
        await onTriggerScanRef.current(nextProjectId);
        void refetchAuditsRef.current();
        void refetchWorkspaceRef.current();
      } finally {
        triggerInFlightRef.current = false;
      }
    };

    const scheduleNextRotate = () => {
      timer = window.setTimeout(async () => {
        if (cancelled) return;
        await rotate().catch(() => undefined);
        if (cancelled) return;
        scheduleNextRotate();
      }, ROTATION_MS);
    };

    void rotate().finally(() => {
      if (!cancelled) {
        scheduleNextRotate();
      }
    });
    return () => {
      cancelled = true;
      if (timer) {
        window.clearTimeout(timer);
      }
    };
  }, [enabled]);

  return { pipelineActive };
}
