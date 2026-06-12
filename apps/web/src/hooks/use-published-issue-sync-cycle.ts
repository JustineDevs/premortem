'use client';

import { useEffect, useRef } from 'react';

/** Background reconciliation while /app is open (webhook is the primary path). */
const RECONCILE_INTERVAL_MS = 5 * 60 * 1000;

interface UsePublishedIssueSyncCycleOptions {
  enabled: boolean;
  publishedIssueCount: number;
  onReconciled?: (result: { reconciledCount?: number; driftedCount?: number }) => void;
}

export function usePublishedIssueSyncCycle({
  enabled,
  publishedIssueCount,
  onReconciled
}: UsePublishedIssueSyncCycleOptions) {
  const runningRef = useRef(false);

  useEffect(() => {
    if (!enabled || publishedIssueCount <= 0) return;

    const run = async () => {
      if (runningRef.current) return;
      runningRef.current = true;
      try {
        const response = await fetch('/api/issues/reconcile', { method: 'POST' });
        if (!response.ok) return;
        const payload = (await response.json()) as {
          reconciledCount?: number;
          driftedCount?: number;
        };
        onReconciled?.(payload);
      } finally {
        runningRef.current = false;
      }
    };

    void run();
    const timer = window.setInterval(() => {
      void run();
    }, RECONCILE_INTERVAL_MS);

    return () => window.clearInterval(timer);
  }, [enabled, publishedIssueCount, onReconciled]);
}
