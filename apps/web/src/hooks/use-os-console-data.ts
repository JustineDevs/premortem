'use client';

import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import type { WorkspaceBundle } from '@/hooks/workspace-types';
import { bffFetchJson, isUnauthorizedBffError, readBffErrorMessage } from '@/lib/bff-client';
import type { AuditRun, Project, ProviderType } from '@/lib/premortem-os/types';
import { CanonicalEvents, trackOsEvent } from '@/providers/posthog-provider';
import type { ConsoleReviewActionValue } from '@premortem/domain';

function normalizeProjectList(payload: unknown): Project[] {
  if (Array.isArray(payload)) return payload as Project[];
  if (payload && typeof payload === 'object' && Array.isArray((payload as { projects?: unknown }).projects)) {
    return (payload as { projects: Project[] }).projects;
  }
  return [];
}

export function useOsConsoleData() {
  const authStatusQuery = useAuthStatusQuery();
  const canLoadConsole = authStatusQuery.data?.authenticated === true || authStatusQuery.data?.mode === 'local_fixture';

  const projectsQuery = useQuery({
    queryKey: ['os', 'projects'],
    queryFn: async () => normalizeProjectList(await bffFetchJson<unknown>('/api/projects')),
    placeholderData: keepPreviousData,
    staleTime: 15_000,
    refetchOnWindowFocus: false,
    enabled: canLoadConsole
  });

  const auditsQuery = useQuery({
    queryKey: ['os', 'audits'],
    queryFn: async () => {
      const payload = await bffFetchJson<{ audits?: AuditRun[]; riskClusters?: unknown[] } | AuditRun[]>(
        '/api/audits?hydrate=0&limit=12'
      );
      if (Array.isArray(payload)) {
        return { audits: payload, riskClusters: [] as unknown[] };
      }
      return {
        audits: payload.audits ?? [],
        riskClusters: payload.riskClusters ?? []
      };
    },
    placeholderData: keepPreviousData,
    staleTime: 15_000,
    refetchOnWindowFocus: false,
    enabled: canLoadConsole,
    refetchInterval: (query) => {
      const audits = query.state.data?.audits ?? [];
      const hasActive = audits.some(
        (audit) => audit.status === 'RUNNING' || audit.status === 'PAUSED'
      );
      return hasActive ? 5000 : false;
    }
  });

  const healthQuery = useQuery({
    queryKey: ['os', 'health'],
    queryFn: () => bffFetchJson<{ apiHealthy?: boolean }>('/api/health'),
    staleTime: 60_000,
    refetchOnWindowFocus: false
  });

  const authError = canLoadConsole
    ? null
    : authStatusQuery.data?.authenticated === false
      ? new Error('Sign in to use the reviewer console.')
      : authStatusQuery.error instanceof Error
        ? authStatusQuery.error
        : authStatusQuery.error
          ? new Error('Unable to resolve authentication state.')
          : null;

  const projectsError = projectsQuery.error;
  const auditsError = auditsQuery.error;
  const loadError =
    projectsError && !isUnauthorizedBffError(projectsError)
      ? projectsError
      : auditsError && !isUnauthorizedBffError(auditsError)
        ? auditsError
        : null;

  return {
    projects: Array.isArray(projectsQuery.data) ? projectsQuery.data : [],
    audits: auditsQuery.data?.audits ?? [],
    riskClusters: auditsQuery.data?.riskClusters ?? [],
    isLoading: authStatusQuery.isLoading || projectsQuery.isLoading,
    isAuditsLoading: authStatusQuery.isLoading || auditsQuery.isLoading,
    error: authError ?? loadError,
    authError,
    loadError,
    apiHealthy: healthQuery.data?.apiHealthy ?? null,
    refetchAudits: auditsQuery.refetch,
    refetchProjects: projectsQuery.refetch
  };
}

export function useAuthStatusQuery() {
  return useQuery({
    queryKey: ['os', 'auth-status'],
    queryFn: () => bffFetchJson<{ authenticated?: boolean; mode?: string }>('/api/auth/status'),
    staleTime: 60_000,
    refetchOnWindowFocus: false
  });
}

export function useWorkspaceQuery() {
  const authStatusQuery = useAuthStatusQuery();
  const canLoadWorkspace =
    authStatusQuery.data?.authenticated === true || authStatusQuery.data?.mode === 'local_fixture';

  return useQuery({
    queryKey: ['os', 'workspace'],
    queryFn: async () => {
      const payload = await bffFetchJson<{ workspace: WorkspaceBundle }>('/api/workspace');
      return payload.workspace;
    },
    staleTime: 30_000,
    refetchOnWindowFocus: false,
    enabled: canLoadWorkspace
  });
}

export function useWorkspaceMutations() {
  const queryClient = useQueryClient();

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: ['os', 'workspace'] });
  };

  const trackMutationError = (scope: string) => (error: unknown) => {
    trackOsEvent('mutation_error', {
      scope,
      message: error instanceof Error ? error.message : String(error)
    });
  };

  const patch = async (path: string, body: unknown) => {
    const response = await fetch(path, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body)
    });
    if (!response.ok) {
      throw new Error(await readBffErrorMessage(response, `Failed to save ${path}`));
    }
    invalidate();
  };

  return {
    patchPolicies: (policies: WorkspaceBundle['policies']) => patch('/api/workspace/policies', { policies }),
    patchRuntime: (continuousAuditEnabled: boolean) =>
      patch('/api/workspace/runtime', { continuousAuditEnabled }),
    patchWorkItemAttributes: (workItemAttributes: WorkspaceBundle['workItemAttributes']) =>
      patch('/api/workspace/work-item-attributes', { workItemAttributes }),
    patchNotifications: (notifications: Partial<WorkspaceBundle['notifications']>) =>
      patch('/api/workspace/notifications', { notifications }),
    patchLlm: (llm: Partial<WorkspaceBundle['llm']>) => patch('/api/workspace/llm', { llm }),
    patchProfile: (profile: { fullName?: string; username?: string; timezone?: string; bio?: string }) =>
      patch('/api/workspace/profile', profile),
    patchOrganization: (organization: { name?: string; billingEmail?: string; websiteUrl?: string }) =>
      patch('/api/workspace/organization', organization),
    patchBillingPlan: (plan: 'free' | 'pro' | 'team' | 'enterprise') =>
      patch('/api/workspace/billing', { plan }),
    createApiKey: async (label: string) => {
      const response = await fetch('/api/workspace/api-keys', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ label })
      });
      if (!response.ok) {
        throw new Error(await readBffErrorMessage(response, 'Failed to create API key.'));
      }
      invalidate();
      return response.json() as Promise<{ ok: true; apiKey: { apiKey: string; key: { id: string; label: string; keyPrefix: string } } }>;
    },
    revokeApiKey: async (keyId: string) => {
      const response = await fetch(`/api/workspace/api-keys/${keyId}`, {
        method: 'DELETE'
      });
      if (!response.ok) {
        throw new Error(await readBffErrorMessage(response, 'Failed to revoke API key.'));
      }
      invalidate();
      return response.json() as Promise<{ ok: true }>;
    },
    registerIntegration: async (input: {
      provider?: 'gitlab' | 'github';
      externalAccountName: string;
      externalAccountId?: string;
      accessScope?: Record<string, unknown>;
    }) => {
      const response = await fetch('/api/workspace/integrations', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(input)
      });
      if (!response.ok) {
        throw new Error(await readBffErrorMessage(response, 'Failed to register integration.'));
      }
      trackOsEvent(CanonicalEvents.integrationRegistered, { provider: input.provider ?? 'gitlab' });
      invalidate();
    },
    syncIntegration: async (integrationId: string) => {
      const response = await fetch(`/api/workspace/integrations/${integrationId}/sync`, { method: 'POST' });
      if (!response.ok) {
        throw new Error(await readBffErrorMessage(response, 'Failed to sync integration.'));
      }
      trackOsEvent(CanonicalEvents.integrationSynced, { integrationId });
      invalidate();
    },
    startCheckout: async (plan: 'pro' | 'team', interval: 'monthly' | 'yearly' = 'monthly') => {
      trackOsEvent(CanonicalEvents.checkoutStarted, { plan, interval });
      const response = await fetch('/api/billing/checkout', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ plan, interval })
      });
      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(
          typeof payload.error === 'string' ? payload.error : 'Failed to start Stripe checkout.'
        );
      }
      const payload = await response.json();
      if (payload.url) {
        window.location.href = payload.url;
      }
    },
    startBillingPortal: async () => {
      const response = await fetch('/api/billing/portal', {
        method: 'POST'
      });
      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(
          typeof payload.error === 'string' ? payload.error : 'Failed to open billing portal.'
        );
      }
      const payload = (await response.json()) as { url?: string };
      if (payload.url) {
        window.location.href = payload.url;
      }
    },
    reconcileIssues: useMutation({
      mutationFn: async () => {
        const response = await fetch('/api/issues/reconcile', { method: 'POST' });
        if (!response.ok) {
          throw new Error(await readBffErrorMessage(response, 'Reconciliation failed.'));
        }
        return response.json();
      },
      onSuccess: (result) => {
        trackOsEvent(CanonicalEvents.issuesReconciled, result);
        void queryClient.invalidateQueries({ queryKey: ['os', 'reconciliation'] });
      },
      onError: trackMutationError('reconcileIssues')
    }),
    cancelAudit: useMutation({
      mutationFn: async (auditRunId: string) => {
        const response = await fetch(`/api/audits/${auditRunId}/cancel`, { method: 'POST' });
        if (!response.ok) {
          throw new Error(await readBffErrorMessage(response, 'Failed to cancel audit.'));
        }
        return response.json();
      },
      onSuccess: () => {
        trackOsEvent(CanonicalEvents.auditCancelled);
        void queryClient.invalidateQueries({ queryKey: ['os', 'audits'] });
      },
      onError: trackMutationError('cancelAudit')
    }),
    pauseAudit: useMutation({
      mutationFn: async (auditRunId: string) => {
        const response = await fetch(`/api/audits/${auditRunId}/pause`, { method: 'POST' });
        if (!response.ok) {
          throw new Error(await readBffErrorMessage(response, 'Failed to pause audit.'));
        }
        return response.json();
      },
      onSuccess: () => {
        trackOsEvent(CanonicalEvents.auditPaused);
        void queryClient.invalidateQueries({ queryKey: ['os', 'audits'] });
      },
      onError: trackMutationError('pauseAudit')
    }),
    resumeAudit: useMutation({
      mutationFn: async (auditRunId: string) => {
        const response = await fetch(`/api/audits/${auditRunId}/resume`, { method: 'POST' });
        if (!response.ok) {
          throw new Error(await readBffErrorMessage(response, 'Failed to resume audit.'));
        }
        return response.json();
      },
      onSuccess: () => {
        trackOsEvent(CanonicalEvents.auditResumed);
        void queryClient.invalidateQueries({ queryKey: ['os', 'audits'] });
      },
      onError: trackMutationError('resumeAudit')
    }),
    stopAllRuntime: useMutation({
      mutationFn: async () => {
        const response = await fetch('/api/workspace/runtime/stop-all', { method: 'POST' });
        if (!response.ok) {
          throw new Error(await readBffErrorMessage(response, 'Failed to stop runtime.'));
        }
        return response.json();
      },
      onSuccess: () => {
        void queryClient.invalidateQueries({ queryKey: ['os', 'workspace'] });
        void queryClient.invalidateQueries({ queryKey: ['os', 'audits'] });
      },
      onError: trackMutationError('stopAllRuntime')
    })
  };
}

export function useReconciliationEvents(enabled = true) {
  return useQuery({
    queryKey: ['os', 'reconciliation'],
    queryFn: () =>
      bffFetchJson<{ events: Array<{
        id: string;
        status: string;
        driftFields: string[];
        createdAt: string;
        publishedIssue?: { publishedTitle?: string; url?: string | null; syncStatus?: string };
      }> }>('/api/reconciliation')
    ,
    placeholderData: keepPreviousData,
    staleTime: 10_000,
    refetchOnWindowFocus: false,
    enabled
  });
}

export function useRepositoryDiscoveryMutations() {
  const queryClient = useQueryClient();

  const invalidateProjects = () => {
    void queryClient.invalidateQueries({ queryKey: ['os', 'projects'] });
    void queryClient.invalidateQueries({ queryKey: ['os', 'workspace'] });
  };

  const trackMutationError = (scope: string) => (error: unknown) => {
    trackOsEvent('mutation_error', {
      scope,
      message: error instanceof Error ? error.message : String(error)
    });
  };

  return {
    discoverRepositories: useMutation({
      mutationFn: async (integrationId: string) => {
        const response = await fetch(`/api/workspace/integrations/${integrationId}/repositories`);
        if (!response.ok) {
          const payload = await response.json().catch(() => ({}));
          throw new Error(payload.error || 'Failed to discover repositories.');
        }
        return response.json() as Promise<{
          repositories: Array<{
            externalProjectId: string;
            name: string;
            repoUrl: string;
            defaultBranch: string;
            visibility: string;
            enabled: boolean;
            projectId: string | null;
            canWriteIssues: boolean;
          }>;
          lastSyncedAt: string | null;
        }>;
      },
      onError: trackMutationError('discoverRepositories')
    }),
    enableRepositories: useMutation({
      mutationFn: async (input: { integrationId: string; externalProjectIds: string[] }) => {
        const response = await fetch(
          `/api/workspace/integrations/${input.integrationId}/repositories/enable`,
          {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ externalProjectIds: input.externalProjectIds })
          }
        );
        const payload = await response.json();
        if (!response.ok && !payload.enabled?.length) {
          const detail =
            payload.errors?.map((entry: { error?: string }) => entry.error).filter(Boolean).join(' ') ||
            payload.error;
          throw new Error(detail || 'Failed to enable repositories.');
        }
        return payload as {
          enabled: Array<{ id: string; externalProjectId: string; name: string }>;
          errors: Array<{ externalProjectId: string; error: string; code?: string }>;
        };
      },
      onSuccess: () => {
        trackOsEvent(CanonicalEvents.projectRegistered);
        invalidateProjects();
      },
      onError: trackMutationError('enableRepositories')
    }),
    disableRepository: useMutation({
      mutationFn: async (input: { integrationId: string; projectId: string }) => {
        const response = await fetch(
          `/api/workspace/integrations/${input.integrationId}/repositories/disable`,
          {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ projectId: input.projectId })
          }
        );
        if (!response.ok) {
          const payload = await response.json().catch(() => ({}));
          throw new Error(payload.error || 'Failed to disable repository.');
        }
        return response.json();
      },
      onSuccess: () => invalidateProjects(),
      onError: trackMutationError('disableRepository')
    }),
    registerPublicRepository: useMutation({
      mutationFn: async (reference: string) => {
        const response = await fetch('/api/projects/public', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ reference })
        });
        if (!response.ok) {
          const payload = await response.json().catch(() => ({}));
          throw new Error(payload.error || 'Failed to register public repository.');
        }
        return response.json() as Promise<Project>;
      },
      onSuccess: () => {
        trackOsEvent(CanonicalEvents.projectRegistered);
        invalidateProjects();
      },
      onError: trackMutationError('registerPublicRepository')
    })
  };
}

export function useAuditMutations() {
  const queryClient = useQueryClient();

  const invalidateAudits = () => {
    void queryClient.invalidateQueries({ queryKey: ['os', 'audits'] });
    void queryClient.invalidateQueries({ queryKey: ['os', 'audit-detail'] });
  };

  const invalidateProjects = () => {
    void queryClient.invalidateQueries({ queryKey: ['os', 'projects'] });
  };

  const trackMutationError = (scope: string) => (error: unknown) => {
    trackOsEvent('mutation_error', {
      scope,
      message: error instanceof Error ? error.message : String(error)
    });
  };

  const fetchAuditDetail = async (auditId: string) => {
    return queryClient.fetchQuery<AuditRun | null>({
      queryKey: ['os', 'audit-detail', auditId],
      queryFn: async () => {
        const response = await fetch(`/api/audits/${auditId}`);
        if (!response.ok) return null;
        return response.json() as Promise<AuditRun>;
      },
      staleTime: 30_000
    });
  };

  return {
    registerProject: useMutation({
      mutationFn: async (input: {
        name: string;
        repoUrl: string;
        branch: string;
        provider: ProviderType;
        scanCodeSnippet?: string;
      }) => {
        const response = await fetch('/api/projects', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(input)
        });
        if (!response.ok) {
          throw new Error(await readBffErrorMessage(response, 'Unable to register repository resource.'));
        }
        return response.json() as Promise<Project>;
      },
      onSuccess: () => {
        trackOsEvent(CanonicalEvents.projectRegistered);
        trackOsEvent(CanonicalEvents.configValidated, { step: 'project_registered' });
        invalidateProjects();
      },
      onError: trackMutationError('registerProject')
    }),
    triggerAudit: useMutation({
      mutationFn: async (input: { projectId?: string; customSnippet?: string }) => {
        const response = await fetch('/api/audits/run', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(input)
        });
        if (!response.ok) {
          const errPayload = await response.json().catch(() => ({}));
          throw new Error(errPayload.error || 'Audit run failed.');
        }
        return response.json();
      },
      onSuccess: (_result, variables) => {
        trackOsEvent(CanonicalEvents.auditTriggered, variables);
        if (variables.customSnippet?.trim()) return;
        invalidateAudits();
        invalidateProjects();
      },
      onError: trackMutationError('triggerAudit')
    }),
    reviewIssue: useMutation({
      mutationFn: async (input: {
        auditId: string;
        issueId: string;
        action: ConsoleReviewActionValue;
      }) => {
        const response = await fetch(`/api/audits/${input.auditId}/issues/${input.issueId}/action`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: input.action })
        });
        if (!response.ok) {
          throw new Error(await readBffErrorMessage(response, 'Failed to update finding.'));
        }
        return response.json();
      },
      onSuccess: (_result, variables) => {
        trackOsEvent(CanonicalEvents.issueReviewed, variables);
        invalidateAudits();
      },
      onError: trackMutationError('reviewIssue')
    }),
    persistFindingFields: useMutation({
      mutationFn: async (input: {
        auditId: string;
        findingId: string;
        fields: {
          title?: string;
          whyItMatters?: string;
          description?: string;
          recommendation?: string;
        };
      }) => {
        const payload = {
          title: input.fields.title,
          whyItMatters: input.fields.whyItMatters,
          description: input.fields.description,
          recommendedActionSummary: input.fields.recommendation
        };
        const response = await fetch(`/api/audits/${input.auditId}/issues/${input.findingId}/edit`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
        if (!response.ok) {
          const errPayload = await response.json().catch(() => ({}));
          throw new Error(errPayload.error || 'Failed to save synthesis fields.');
        }
        return response.json();
      },
      onSuccess: () => invalidateAudits()
      ,
      onError: trackMutationError('persistFindingFields')
    }),
    deployPatch: useMutation({
      mutationFn: async (input: { auditId: string; issueId: string }) => {
        const response = await fetch(`/api/audits/${input.auditId}/patch`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ issueId: input.issueId })
        });
        if (!response.ok) {
          throw new Error(await readBffErrorMessage(response, 'Patch deployment request failed.'));
        }
        return response.json();
      },
      onSuccess: () => invalidateAudits()
      ,
      onError: trackMutationError('deployPatch')
    }),
    fetchAuditDetail
  };
}
