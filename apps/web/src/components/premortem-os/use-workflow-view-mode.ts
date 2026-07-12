'use client';

import { useCallback, useMemo, useRef, useState } from 'react';
import { defaultViewModeForStep, type WorkflowCanvasViewMode } from '@premortem/domain';

const VIEW_MODE_STORAGE_KEY = 'premortem-workflow-view-mode';
const MANUAL_OVERRIDE_MS = 30_000;

function readStoredViewMode(): WorkflowCanvasViewMode {
  if (typeof window === 'undefined') return 'split';
  const stored = sessionStorage.getItem(VIEW_MODE_STORAGE_KEY);
  if (stored === 'graph' || stored === 'split' || stored === 'workbench') return stored;
  return 'split';
}

export function useWorkflowViewMode(activeNodeId: string | null, stepIds: readonly string[]) {
  const [storedViewMode, setStoredViewMode] = useState<WorkflowCanvasViewMode>(readStoredViewMode);
  const manualUntilRef = useRef(0);

  const setViewMode = useCallback((mode: WorkflowCanvasViewMode, manual = true) => {
    if (manual) {
      manualUntilRef.current = Date.now() + MANUAL_OVERRIDE_MS;
    }
    setStoredViewMode(mode);
    if (typeof window !== 'undefined') {
      sessionStorage.setItem(VIEW_MODE_STORAGE_KEY, mode);
    }
  }, []);

  const viewMode = useMemo(() => {
    if (Date.now() < manualUntilRef.current) {
      return storedViewMode;
    }

    if (!activeNodeId) {
      return storedViewMode;
    }

    const stepIndex = stepIds.indexOf(activeNodeId);
    return stepIndex >= 0 ? defaultViewModeForStep(stepIndex) : storedViewMode;
  }, [activeNodeId, stepIds, storedViewMode]);

  return { viewMode, setViewMode };
}
