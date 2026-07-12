'use client';

import { useEffect, useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';

import { buildOsQueryKey, type OsQueryScope } from '@/hooks/use-os-console-data';
import { shouldRetryBffQuery } from '@/lib/bff-client';
import { createSupabaseBrowserClient } from '@/lib/supabase/browser';
import { isSupabaseAuthConfigured, resolveSupabaseRuntimeConfig } from '@/lib/supabase/config';

import type { WorkflowAuditSnapshot } from './workflow-canvas.types';

type RealtimeConnectionState = 'idle' | 'connecting' | 'connected' | 'error';

export interface UseAuditRealtimeResult {
  snapshot: WorkflowAuditSnapshot | null;
  isLoading: boolean;
  isFetching: boolean;
  connectionState: RealtimeConnectionState;
  isRealtimeReady: boolean;
}

async function fetchAuditSnapshot(auditRunId: string): Promise<WorkflowAuditSnapshot | null> {
  const response = await fetch(`/api/audits/${auditRunId}?hydrate=0`, { cache: 'no-store' });
  if (!response.ok) {
    throw new Error(`Failed to load audit snapshot: ${response.status} ${response.statusText}`);
  }
  const payload = await response.json();
  return (payload.snapshot ?? payload.auditRun ?? null) as WorkflowAuditSnapshot | null;
}

export function useAuditRealtime(
  auditRunId: string | undefined,
  options?: { enabled?: boolean; queryScope?: OsQueryScope }
): UseAuditRealtimeResult {
  const enabled = Boolean(auditRunId) && (options?.enabled ?? true);
  const queryClient = useQueryClient();
  const queryKey = useMemo(
    () => buildOsQueryKey(options?.queryScope, 'audit-snapshot', auditRunId),
    [auditRunId, options?.queryScope]
  );
  const [connectionState, setConnectionState] = useState<RealtimeConnectionState>('idle');

  const { data, isLoading, isFetching } = useQuery({
    queryKey,
    enabled,
    staleTime: 15_000,
    refetchOnMount: false,
    refetchOnWindowFocus: false,
    retry: shouldRetryBffQuery,
    queryFn: async () => (auditRunId ? fetchAuditSnapshot(auditRunId) : null)
  });

  const supabase = useMemo(() => {
    if (!enabled || !auditRunId || !isSupabaseAuthConfigured()) return null;
    return createSupabaseBrowserClient(resolveSupabaseRuntimeConfig());
  }, [auditRunId, enabled]);

  useEffect(() => {
    if (!enabled || !auditRunId || !supabase) {
      setConnectionState('idle');
      return undefined;
    }

    setConnectionState('connecting');
    const channel = supabase
      .channel(`workflow-audit-live:${auditRunId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'audit_run_events',
          filter: `auditRunId=eq.${auditRunId}`
        },
        () => {
          void queryClient.invalidateQueries({ queryKey, exact: true });
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'audit_runs',
          filter: `id=eq.${auditRunId}`
        },
        () => {
          void queryClient.invalidateQueries({ queryKey, exact: true });
        }
      )
      .subscribe((status: 'SUBSCRIBED' | 'TIMED_OUT' | 'CHANNEL_ERROR' | 'CLOSED' | string) => {
        if (status === 'SUBSCRIBED') {
          setConnectionState('connected');
          return;
        }
        if (status === 'TIMED_OUT' || status === 'CHANNEL_ERROR') {
          setConnectionState('error');
          return;
        }
        if (status === 'CLOSED') {
          setConnectionState('idle');
          return;
        }
        setConnectionState('connecting');
      });

    return () => {
      setConnectionState('idle');
      void supabase.removeChannel(channel);
    };
  }, [auditRunId, enabled, queryClient, queryKey, supabase]);

  return {
    snapshot: data ?? null,
    isLoading,
    isFetching,
    connectionState,
    isRealtimeReady: Boolean(supabase)
  };
}
