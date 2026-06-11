'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
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
  const [viewMode, setViewModeState] = useState<WorkflowCanvasViewMode>('split');
  const manualUntilRef = useRef(0);

  useEffect(() => {
    setViewModeState(readStoredViewMode());
  }, []);

  const setViewMode = useCallback((mode: WorkflowCanvasViewMode, manual = true) => {
    if (manual) {
      manualUntilRef.current = Date.now() + MANUAL_OVERRIDE_MS;
    }
    setViewModeState(mode);
    if (typeof window !== 'undefined') {
      sessionStorage.setItem(VIEW_MODE_STORAGE_KEY, mode);
    }
  }, []);

  useEffect(() => {
    if (!activeNodeId) return;
    if (Date.now() < manualUntilRef.current) return;
    const stepIndex = stepIds.indexOf(activeNodeId);
    if (stepIndex >= 0) {
      setViewModeState(defaultViewModeForStep(stepIndex));
    }
  }, [activeNodeId, stepIds]);

  return { viewMode, setViewMode };
}
