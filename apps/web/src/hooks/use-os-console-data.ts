'use client';

import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback, useMemo } from 'react';
import { z } from 'zod';

import type { WorkspaceBundle } from '@/hooks/workspace-types';
import {
  bffFetchJson,
  isUnauthorizedBffError,
  readBffErrorMessage,
  shouldRetryBffQuery
} from '@/lib/bff-client';
import type { AuditRun, Project, ProviderType } from '@/lib/premortem-os/types';
import { mergeConsoleProjects } from '@/lib/premortem-os/merge-console-projects';
import { normalizeVendorRouting } from '@/lib/premortem-os/vendor-pool';
import { mapAuditListItemToAuditRun, mapRuntimeProject } from '@/lib/premortem-api/map-runtime-to-console';
import { CanonicalEvents, trackOsEvent } from '@/providers/posthog-provider';
import {
  normalizeWorkItemAttributeConfig,
  SUPPORTED_WORKSPACE_MODELS,
  type ConsoleReviewActionValue
} from '@premortem/domain';

type AuditListItem = {
  auditRunId?: string;
  id?: string;
  projectId: string;
  branch: string;
  runStatus?: string;
  status?: string;
  createdAt?: string;
  date?: string;
  projectName?: string;
  reviewableIssueCount?: number;
  reviewableCount?: number;
  rejectedIssueCount?: number;
  rejectedCount?: number;
  latestEventType?: string;
};

type OsAuthStatus = {
  authenticated?: boolean;
  mode?: string;
  organizationId?: string | null;
};

type HealthState = {
  apiHealthy?: boolean;
  unauthorized?: boolean;
};

export type OsQueryScope = Pick<OsAuthStatus, 'mode' | 'organizationId'> | null | undefined;

export function buildOsQueryKey(scope: OsQueryScope, ...parts: readonly unknown[]) {
  return ['os', scope?.mode ?? 'unknown', scope?.organizationId ?? 'none', ...parts] as const;
}

export interface OsAuthStatusQueryState {
  data?: OsAuthStatus | null;
  isLoading: boolean;
  error: unknown;
}

const EMPTY_PROJECTS: Project[] = [];
const EMPTY_AUDITS: AuditRun[] = [];
const EMPTY_RISK_CLUSTERS: unknown[] = [];
const ACTIVE_AUDIT_STATUSES = new Set(['RUNNING', 'PAUSED', 'QUEUED']);

function hasHydratedAuditDetails(audit: AuditRun): boolean {
  return Boolean(
    audit.findings.length > 0 ||
      audit.agentRuns?.length ||
      audit.lineage?.length ||
      audit.graphSnapshot ||
      audit.runtimeEventTypes?.length
  );
}

function mergeAuditSummaryWithCachedAudit(incoming: AuditRun, cached?: AuditRun): AuditRun {
  if (!cached || !hasHydratedAuditDetails(cached)) {
    return incoming;
  }

  return {
    ...incoming,
    score: cached.score,
    criticalCount: cached.criticalCount,
    highCount: cached.highCount,
    mediumCount: cached.mediumCount,
    lowCount: cached.lowCount,
    findings: cached.findings,
    agentRuns: cached.agentRuns,
    lineage: cached.lineage,
    graphSnapshot: cached.graphSnapshot,
    runtimeEventTypes: cached.runtimeEventTypes
  };
}

function normalizeProjectRecord(project: Record<string, unknown>): Project {
  return mapRuntimeProject(project);
}

function normalizeAuditListItem(item: AuditListItem): AuditListItem & { id: string; auditRunId: string } {
  const auditRunId =
    typeof item.auditRunId === 'string' && item.auditRunId.length > 0
      ? item.auditRunId
      : typeof item.id === 'string' && item.id.length > 0
        ? item.id
        : '';
  const id = typeof item.id === 'string' && item.id.length > 0 ? item.id : auditRunId;

  return {
    ...item,
    id,
    auditRunId
  };
}

function sortAuditsByDateDesc(audits: AuditRun[]): AuditRun[] {
  return [...audits].sort((left, right) => {
    const leftTime = new Date(left.date).getTime();
    const rightTime = new Date(right.date).getTime();
    if (Number.isNaN(leftTime) && Number.isNaN(rightTime)) {
      return String(right.id).localeCompare(String(left.id));
    }
    if (Number.isNaN(leftTime)) return 1;
    if (Number.isNaN(rightTime)) return -1;
    if (rightTime !== leftTime) return rightTime - leftTime;
    return String(right.id).localeCompare(String(left.id));
  });
}

function normalizeProjectList(payload: unknown): Project[] {
  if (Array.isArray(payload)) {
    return payload
      .filter((project): project is Record<string, unknown> => Boolean(project) && typeof project === 'object')
      .map(normalizeProjectRecord);
  }
  if (payload && typeof payload === 'object' && Array.isArray((payload as { projects?: unknown }).projects)) {
    return (payload as { projects: unknown[] }).projects
      .filter((project): project is Record<string, unknown> => Boolean(project) && typeof project === 'object')
      .map(normalizeProjectRecord);
  }
  return [];
}

const trackMutationError =
  (scope: string) =>
  (error: unknown) => {
    trackOsEvent('mutation_error', {
      scope,
      message: error instanceof Error ? error.message : String(error)
    });
  };

const JsonObjectSchema = z.object({}).passthrough();

const ReconcileIssuesResponseSchema = z.object({
  reconciledCount: z.number().optional(),
  driftedCount: z.number().optional()
});

const TriggerAuditResponseSchema = z.object({
  success: z.boolean(),
  audit: z.any().optional(),
  auditRunId: z.string().optional(),
  projectId: z.string().optional(),
  async: z.boolean().optional(),
  message: z.string().optional()
});

const ReviewMutationResponseSchema = z.object({
  success: z.boolean().optional()
});

const NangoConnectSessionResponseSchema = z.object({
  ok: z.boolean().optional(),
  connectSessionToken: z.string().optional(),
  connectLink: z.string().optional(),
  expiresAt: z.string().optional()
});

const SlackNangoSyncResponseSchema = z.object({
  ok: z.boolean().optional(),
  connection: z
    .object({
      id: z.string(),
      providerConfigKey: z.string().optional(),
      integrationId: z.string().optional()
    })
    .optional()
});

const BillingSubscriptionCancelResponseSchema = z.object({
  ok: z.boolean().optional(),
  mode: z.enum(['period_end', 'immediate']).optional(),
  billingStatus: z.string().optional(),
  refundedAmount: z.number().optional(),
  refundStatus: z.enum(['not_requested', 'refunded', 'not_available', 'failed']).optional(),
  currentPeriodEnd: z.string().nullable().optional()
});

function parseJsonObject<T>(value: unknown): T {
  return JsonObjectSchema.parse(value) as T;
}

function normalizeCustomProviders(
  value: unknown,
  fallback: WorkspaceBundle['llm']['customProviders']
): WorkspaceBundle['llm']['customProviders'] {
  if (!Array.isArray(value)) return fallback;
  return value
    .filter((provider): provider is Record<string, unknown> => Boolean(provider) && typeof provider === 'object')
    .map((provider) => ({
      name: String(provider.name ?? ''),
      host: String(provider.host ?? ''),
      model: String(provider.model ?? ''),
      active: provider.active === true
    }))
    .filter((provider) => Boolean(provider.name));
}

function normalizeWorkspaceModel(model: string | null | undefined) {
  if (!model) return 'gemini-2.5-flash';
  if ((SUPPORTED_WORKSPACE_MODELS as readonly string[]).includes(model)) {
    return model;
  }
  if (model === 'gemini-3-flash-preview') {
    return 'gemini-2.5-flash';
  }
  return 'gemini-2.5-flash';
}

function updateWorkspaceCacheFromPatch(
  current: WorkspaceBundle | null,
  path: string,
  body: unknown
): WorkspaceBundle | null {
  if (!current || !body || typeof body !== 'object') return current;
  const payload = body as Record<string, unknown>;

  if (path === '/api/workspace/profile') {
    return {
      ...current,
      profile: {
        ...current.profile,
        fullName:
          typeof payload.fullName === 'string' ? payload.fullName : current.profile.fullName,
        username:
          typeof payload.username === 'string' ? payload.username : current.profile.username,
        timezone:
          typeof payload.timezone === 'string' ? payload.timezone : current.profile.timezone,
        avatarUrl: current.profile.avatarUrl
      }
    };
  }

  if (path === '/api/workspace/organization') {
    return {
      ...current,
      organization: {
        ...current.organization,
        name: typeof payload.name === 'string' ? payload.name : current.organization.name,
        billingEmail:
          typeof payload.billingEmail === 'string'
            ? payload.billingEmail
            : current.organization.billingEmail,
        websiteUrl:
          typeof payload.websiteUrl === 'string'
            ? payload.websiteUrl
            : current.organization.websiteUrl
      }
    };
  }

  if (path === '/api/workspace/policies' && Array.isArray(payload.policies)) {
    return {
      ...current,
      policies: payload.policies.filter((policy): policy is { id: string; name: string; description: string; active: boolean } =>
        Boolean(policy) && typeof policy === 'object' && typeof policy.id === 'string'
      ).map((policy) => ({
        id: String(policy.id),
        name: String(policy.name ?? ''),
        description: String(policy.description ?? ''),
        active: policy.active === true
      }))
    };
  }

  if (path === '/api/workspace/runtime' && typeof payload.continuousAuditEnabled === 'boolean') {
    return {
      ...current,
      runtime: {
        ...current.runtime,
        continuousAuditEnabled: payload.continuousAuditEnabled
      }
    };
  }

  if (path === '/api/workspace/work-item-attributes' && payload.workItemAttributes && typeof payload.workItemAttributes === 'object') {
    return {
      ...current,
      workItemAttributes: normalizeWorkItemAttributeConfig(payload.workItemAttributes)
    };
  }

  if (path === '/api/workspace/notifications' && payload.notifications && typeof payload.notifications === 'object') {
    const notifications = payload.notifications as Record<string, unknown>;
    return {
      ...current,
      notifications: {
        ...current.notifications,
        slackWebhook:
          typeof notifications.slackWebhook === 'string'
            ? notifications.slackWebhook
            : current.notifications.slackWebhook,
        slackChannel:
          typeof notifications.slackChannel === 'string'
            ? notifications.slackChannel
            : current.notifications.slackChannel,
        isSlackConnected:
          typeof notifications.isSlackConnected === 'boolean'
            ? notifications.isSlackConnected
            : current.notifications.isSlackConnected,
        alertEmails:
          typeof notifications.alertEmails === 'string'
            ? notifications.alertEmails
            : current.notifications.alertEmails,
        alertSeverity:
          typeof notifications.alertSeverity === 'string'
            ? notifications.alertSeverity
            : current.notifications.alertSeverity,
        slackNangoConnectionId:
          typeof notifications.slackNangoConnectionId === 'string'
            ? notifications.slackNangoConnectionId
            : current.notifications.slackNangoConnectionId,
        slackNangoProviderKey:
          typeof notifications.slackNangoProviderKey === 'string'
            ? notifications.slackNangoProviderKey
            : current.notifications.slackNangoProviderKey
      }
    };
  }

  if (path === '/api/workspace/llm' && payload.llm && typeof payload.llm === 'object') {
    const llm = payload.llm as Record<string, unknown>;
    const customProviders = normalizeCustomProviders(llm.customProviders, current.llm.customProviders);
    const activeProviderNames = customProviders.filter((provider) => provider.active).map((provider) => provider.name);
    return {
        ...current,
        llm: {
          ...current.llm,
          selectedGeminiModel: normalizeWorkspaceModel(
            typeof llm.selectedGeminiModel === 'string'
              ? llm.selectedGeminiModel
              : current.llm.selectedGeminiModel
          ),
          maxTokens:
            typeof llm.maxTokens === 'number' && Number.isFinite(llm.maxTokens)
              ? llm.maxTokens
            : current.llm.maxTokens,
        temperature:
          typeof llm.temperature === 'number' && Number.isFinite(llm.temperature)
            ? llm.temperature
            : current.llm.temperature,
        customProviders,
        vendorRouting: normalizeVendorRouting(
          Array.isArray(llm.vendorRouting) ? llm.vendorRouting : current.llm.vendorRouting,
          activeProviderNames
        )
      }
    };
  }

  if (path === '/api/workspace/billing' && typeof payload.plan === 'string') {
    return {
      ...current,
      billing: {
        ...current.billing,
        plan: payload.plan
      }
    };
  }

  return current;
}

export function useOsConsoleData(options: { authStatusQuery: OsAuthStatusQueryState }) {
  const queryClient = useQueryClient();
  const authStatusQuery = options.authStatusQuery;
  const authStatus = authStatusQuery.data ?? null;
  const authStatusLoading = authStatusQuery.isLoading;
  const authStatusError = authStatusQuery.error;
  const canLoadConsole = authStatus?.authenticated === true || authStatus?.mode === 'local_fixture';
  const projectsQueryKey = buildOsQueryKey(authStatus, 'projects');
  const auditsQueryKey = buildOsQueryKey(authStatus, 'audits');

  const {
    data: projectsData,
    isLoading: projectsLoading,
    error: projectsError,
    refetch: refetchProjects
  } = useQuery({
    queryKey: projectsQueryKey,
    queryFn: async () => normalizeProjectList(await bffFetchJson<unknown>('/api/projects')),
    placeholderData: keepPreviousData,
    staleTime: 30_000,
    refetchOnMount: false,
    refetchOnWindowFocus: false,
    enabled: canLoadConsole,
    retry: shouldRetryBffQuery
  });

  const {
    data: auditsData,
    isLoading: auditsLoading,
    error: auditsError,
    refetch: refetchAudits
  } = useQuery({
    queryKey: auditsQueryKey,
    queryFn: async () => {
      const cachedAudits = queryClient.getQueryData<{ audits?: AuditRun[] } | AuditRun[]>(auditsQueryKey);
      const cachedAuditById = new Map(
        Array.isArray(cachedAudits)
          ? cachedAudits.map((audit) => [audit.id, audit] as const)
          : cachedAudits?.audits?.map((audit) => [audit.id, audit] as const) ?? []
      );
      const payload = await bffFetchJson<{ audits?: AuditListItem[]; riskClusters?: unknown[] } | AuditListItem[]>(
        '/api/audits?hydrate=0&limit=12'
      );
      const mergeCachedAudit = (audit: AuditRun) =>
        mergeAuditSummaryWithCachedAudit(audit, cachedAuditById.get(audit.id));
      if (Array.isArray(payload)) {
        return {
          audits: payload
            .map((item) => normalizeAuditListItem(item))
            .map((item) => mapAuditListItemToAuditRun(item, item.projectName ?? item.projectId))
            .map(mergeCachedAudit),
          riskClusters: [] as unknown[]
        };
      }
      return {
        audits: (payload.audits ?? [])
          .map((item) => normalizeAuditListItem(item))
          .map((item) => mapAuditListItemToAuditRun(item, item.projectName ?? item.projectId))
          .map(mergeCachedAudit),
        riskClusters: payload.riskClusters ?? []
      };
    },
    placeholderData: keepPreviousData,
    staleTime: 15_000,
    refetchOnMount: false,
    refetchOnWindowFocus: false,
    enabled: canLoadConsole,
    retry: shouldRetryBffQuery,
    refetchInterval: (query) => {
      if (isUnauthorizedBffError(query.state.error)) return false;
      const audits = query.state.data?.audits ?? [];
      const hasActive = audits.some((audit) => ACTIVE_AUDIT_STATUSES.has(audit.status));
      return hasActive ? 5000 : false;
    }
  });

  const auditsList = auditsData?.audits ?? EMPTY_AUDITS;
  const sortedAudits = useMemo(() => sortAuditsByDateDesc(auditsList), [auditsList]);
  const normalizedProjects = Array.isArray(projectsData) ? projectsData : EMPTY_PROJECTS;
  const mergedProjects = useMemo(
    () => mergeConsoleProjects(normalizedProjects, sortedAudits),
    [normalizedProjects, sortedAudits]
  );

  const { data: healthData } = useQuery({
    queryKey: buildOsQueryKey(null, 'health'),
    queryFn: async () => {
      const response = await fetch('/api/health', { cache: 'no-store' });
      if (response.status === 401 || response.status === 403) {
        return { apiHealthy: false, unauthorized: true } satisfies HealthState;
      }
      if (!response.ok) {
        throw new Error(`Health check failed (${response.status})`);
      }
      return (await response.json()) as HealthState;
    },
    staleTime: 30_000,
    refetchOnMount: false,
    refetchOnWindowFocus: false,
    enabled: canLoadConsole,
    retry: shouldRetryBffQuery,
    refetchInterval: (query) => {
      if (
        !canLoadConsole ||
        isUnauthorizedBffError(query.state.error) ||
        query.state.data?.unauthorized
      ) {
        return false;
      }
      return 30_000;
    }
  });

  const authError = canLoadConsole
    ? null
    : authStatus?.authenticated === false
      ? new Error('Sign in to use the reviewer console.')
      : authStatusError instanceof Error
        ? authStatusError
        : authStatusError
          ? new Error('Unable to resolve authentication state.')
          : null;

  const loadError =
    projectsError && !isUnauthorizedBffError(projectsError)
      ? projectsError
      : auditsError && !isUnauthorizedBffError(auditsError)
        ? auditsError
        : null;

  return {
    projects: mergedProjects,
    audits: sortedAudits,
    riskClusters: auditsData?.riskClusters ?? EMPTY_RISK_CLUSTERS,
    isLoading: authStatusLoading && !authStatusQuery.data,
    isAuditsLoading: authStatusLoading && !authStatusQuery.data,
    error: authError ?? loadError,
    authError,
    loadError,
    apiHealthy: healthData?.apiHealthy ?? null,
    refetchAudits,
    refetchProjects
  };
}

export function useAuthStatusQuery() {
  return useQuery({
    queryKey: buildOsQueryKey(null, 'auth-status'),
    queryFn: () =>
      bffFetchJson<{ authenticated?: boolean; mode?: string; organizationId?: string | null }>(
        '/api/auth/status'
      ),
    staleTime: 30_000,
    refetchOnMount: false,
    refetchOnWindowFocus: false,
    retry: shouldRetryBffQuery
  });
}

export function useWorkspaceQuery(options: { authStatusQuery: OsAuthStatusQueryState }) {
  const authStatusQuery = options.authStatusQuery;
  const authStatus = authStatusQuery.data ?? null;
  const canLoadWorkspace = authStatus?.authenticated === true || authStatus?.mode === 'local_fixture';
  const workspaceQueryKey = buildOsQueryKey(authStatus, 'workspace');

  return useQuery({
    queryKey: workspaceQueryKey,
    queryFn: async () => {
      const payload = await bffFetchJson<{ workspace: WorkspaceBundle }>('/api/workspace');
      return payload.workspace;
    },
    staleTime: 30_000,
    refetchOnMount: false,
    refetchOnWindowFocus: false,
    enabled: canLoadWorkspace,
    retry: shouldRetryBffQuery,
    refetchInterval: (query) => {
      if (isUnauthorizedBffError(query.state.error)) return false;
      const runningAudits = query.state.data?.runtime.runningAudits ?? 0;
      const continuousAuditEnabled = query.state.data?.runtime.continuousAuditEnabled ?? false;
      if (runningAudits > 0) return 5_000;
      if (continuousAuditEnabled) return 30_000;
      return false;
    }
  });
}

export function useWorkspaceMutations(options?: { authStatusQuery?: OsAuthStatusQueryState | null }) {
  const queryClient = useQueryClient();
  const authStatus = options?.authStatusQuery?.data ?? null;
  const workspaceQueryKey = buildOsQueryKey(authStatus, 'workspace');
  const projectsQueryKey = buildOsQueryKey(authStatus, 'projects');
  const auditsQueryKey = buildOsQueryKey(authStatus, 'audits');
  const reconciliationQueryKey = buildOsQueryKey(authStatus, 'reconciliation');

  const invalidateAuditDetail = useCallback(
    (auditId?: string | null) => {
      if (!auditId) return;
      void queryClient.invalidateQueries({
        queryKey: buildOsQueryKey(authStatus, 'audit-detail', auditId)
      });
    },
    [authStatus, queryClient]
  );

  const invalidateWorkspace = useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: workspaceQueryKey });
  }, [queryClient, workspaceQueryKey]);

  const invalidateConsole = useCallback(() => {
    invalidateWorkspace();
    void queryClient.invalidateQueries({ queryKey: projectsQueryKey });
    void queryClient.invalidateQueries({ queryKey: auditsQueryKey });
    void queryClient.invalidateQueries({ queryKey: reconciliationQueryKey });
  }, [auditsQueryKey, invalidateWorkspace, projectsQueryKey, queryClient, reconciliationQueryKey]);

  const patch = useCallback(async (path: string, body: unknown) => {
    const response = await fetch(path, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body)
    });
    if (!response.ok) {
      throw new Error(await readBffErrorMessage(response, `Failed to save ${path}`));
    }
    queryClient.setQueryData<WorkspaceBundle | null>(workspaceQueryKey, (current) =>
      updateWorkspaceCacheFromPatch(current ?? null, path, body)
    );
    invalidateConsole();
  }, [invalidateConsole, queryClient, workspaceQueryKey]);

  const post = useCallback(async (path: string, body: unknown) => {
    const response = await fetch(path, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body)
    });
    if (!response.ok) {
      throw new Error(await readBffErrorMessage(response, `Failed to save ${path}`));
    }
    invalidateConsole();
    return response.json().catch(() => ({}));
  }, [invalidateConsole]);

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
    patchBillingPlan: (plan: 'free' | 'pro' | 'team' | 'scale' | 'enterprise') =>
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
      invalidateWorkspace();
      return parseJsonObject<{ ok: true; apiKey: { apiKey: string; key: { id: string; label: string; keyPrefix: string } } }>(
        await response.json()
      );
    },
    revokeApiKey: async (keyId: string) => {
      const response = await fetch(`/api/workspace/api-keys/${keyId}`, {
        method: 'DELETE'
      });
      if (!response.ok) {
        throw new Error(await readBffErrorMessage(response, 'Failed to revoke API key.'));
      }
      invalidateWorkspace();
      return parseJsonObject<{ ok: true }>(await response.json());
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
      invalidateConsole();
    },
    syncIntegration: async (integrationId: string) => {
      const response = await fetch(`/api/workspace/integrations/${integrationId}/sync`, { method: 'POST' });
      if (!response.ok) {
        throw new Error(await readBffErrorMessage(response, 'Failed to sync integration.'));
      }
      trackOsEvent(CanonicalEvents.integrationSynced, { integrationId });
      invalidateConsole();
    },
    createSlackConnectSession: async () => {
      const response = await post('/api/workspace/integrations/nango-session', {
        providerConfigKey: 'slack',
        allowedIntegrations: ['slack']
      });
      return NangoConnectSessionResponseSchema.parse(response);
    },
    syncSlackConnection: async () => {
      const response = await post('/api/workspace/notifications/slack/sync', {
        providerConfigKey: 'slack'
      });
      invalidateWorkspace();
      invalidateConsole();
      trackOsEvent(CanonicalEvents.integrationSynced, { integrationId: 'slack' });
      return SlackNangoSyncResponseSchema.parse(response);
    },
    startCheckout: async (plan: 'pro' | 'team' | 'scale', interval: 'monthly' | 'yearly' = 'monthly') => {
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
        window.location.assign(payload.url);
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
      const payload = await response.json();
      if (payload.url) {
        window.location.assign(payload.url);
      }
    },
    cancelSubscription: useMutation({
      mutationFn: async (input: {
        mode?: 'period_end' | 'immediate';
        refund?: boolean;
        reason?: string;
      }) => {
        const response = await fetch('/api/billing/subscription', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(input)
        });
        const payload = await response.json().catch(() => ({}));
        if (!response.ok) {
          throw new Error(
            typeof payload.error === 'string'
              ? payload.error
              : 'Failed to update subscription.'
          );
        }
        return BillingSubscriptionCancelResponseSchema.parse(payload);
      },
      onSuccess: () => {
        void queryClient.invalidateQueries({ queryKey: workspaceQueryKey });
        void queryClient.invalidateQueries({ queryKey: projectsQueryKey });
        void queryClient.invalidateQueries({ queryKey: auditsQueryKey });
      },
      onError: trackMutationError('cancelSubscription')
    }),
    reconcileIssues: useMutation({
      mutationFn: async () => {
        const response = await fetch('/api/issues/reconcile', { method: 'POST' });
        if (!response.ok) {
          throw new Error(await readBffErrorMessage(response, 'Reconciliation failed.'));
        }
        return ReconcileIssuesResponseSchema.parse(await response.json());
      },
      onSuccess: (result) => {
        trackOsEvent(CanonicalEvents.issuesReconciled, result);
        void queryClient.invalidateQueries({ queryKey: reconciliationQueryKey });
        void queryClient.invalidateQueries({ queryKey: auditsQueryKey });
        void queryClient.invalidateQueries({ queryKey: projectsQueryKey });
        void queryClient.invalidateQueries({ queryKey: workspaceQueryKey });
      },
      onError: trackMutationError('reconcileIssues')
    }),
    cancelAudit: useMutation({
      mutationFn: async (auditRunId: string) => {
        const response = await fetch(`/api/audits/${auditRunId}/cancel`, { method: 'POST' });
        if (!response.ok) {
          throw new Error(await readBffErrorMessage(response, 'Failed to cancel audit.'));
        }
        return parseJsonObject<unknown>(await response.json());
      },
      onSuccess: (_result, auditRunId) => {
        trackOsEvent(CanonicalEvents.auditCancelled);
        void queryClient.invalidateQueries({ queryKey: auditsQueryKey });
        invalidateAuditDetail(auditRunId);
      },
      onError: trackMutationError('cancelAudit')
    }),
    pauseAudit: useMutation({
      mutationFn: async (auditRunId: string) => {
        const response = await fetch(`/api/audits/${auditRunId}/pause`, { method: 'POST' });
        if (!response.ok) {
          throw new Error(await readBffErrorMessage(response, 'Failed to pause audit.'));
        }
        return parseJsonObject<unknown>(await response.json());
      },
      onSuccess: (_result, auditRunId) => {
        trackOsEvent(CanonicalEvents.auditPaused);
        void queryClient.invalidateQueries({ queryKey: auditsQueryKey });
        invalidateAuditDetail(auditRunId);
      },
      onError: trackMutationError('pauseAudit')
    }),
    resumeAudit: useMutation({
      mutationFn: async (auditRunId: string) => {
        const response = await fetch(`/api/audits/${auditRunId}/resume`, { method: 'POST' });
        if (!response.ok) {
          throw new Error(await readBffErrorMessage(response, 'Failed to resume audit.'));
        }
        return parseJsonObject<unknown>(await response.json());
      },
      onSuccess: (_result, auditRunId) => {
        trackOsEvent(CanonicalEvents.auditResumed);
        void queryClient.invalidateQueries({ queryKey: auditsQueryKey });
        invalidateAuditDetail(auditRunId);
      },
      onError: trackMutationError('resumeAudit')
    }),
    stopAllRuntime: useMutation({
      mutationFn: async () => {
        const response = await fetch('/api/workspace/runtime/stop-all', { method: 'POST' });
        if (!response.ok) {
          throw new Error(await readBffErrorMessage(response, 'Failed to stop runtime.'));
        }
        return parseJsonObject<unknown>(await response.json());
      },
      onSuccess: () => {
        queryClient.setQueryData<WorkspaceBundle | null>(workspaceQueryKey, (current) => {
          if (!current) return current;
          return {
            ...current,
            runtime: {
              ...current.runtime,
              continuousAuditEnabled: false,
              runningAudits: 0
            }
          };
        });
        queryClient.setQueryData<{ audits: AuditRun[]; riskClusters: unknown[] } | AuditRun[]>(
          auditsQueryKey,
          (current) => {
            const cancelAudit = (audit: AuditRun) =>
              audit.status === 'RUNNING' || audit.status === 'PAUSED' || audit.status === 'QUEUED'
                ? { ...audit, status: 'CANCELLED' as const }
                : audit;

            if (Array.isArray(current)) {
              return current.map(cancelAudit);
            }

            if (!current) {
              return current;
            }

            return {
              ...current,
              audits: current.audits.map(cancelAudit)
            };
          }
        );
        void queryClient.invalidateQueries({ queryKey: workspaceQueryKey });
        void queryClient.invalidateQueries({ queryKey: auditsQueryKey });
      },
      onError: trackMutationError('stopAllRuntime')
    }),
    installSkill: useMutation({
      mutationFn: async (skillId: string) => {
        const response = await fetch('/api/workspace/skills/install', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ skillId })
        });
        const payload = await response.json().catch(() => ({}));
        if (!response.ok) {
          throw new Error(
            typeof payload.error === 'string'
              ? payload.error
              : 'Failed to install skill draft.'
          );
        }
        return parseJsonObject<{ ok: true; installedSkillId: string; skills?: WorkspaceBundle['skills'] }>(
          payload
        );
      },
      onSuccess: (result) => {
        queryClient.setQueryData<WorkspaceBundle | null>(workspaceQueryKey, (current) => {
          if (!current || !result.skills) return current;
          return {
            ...current,
            skills: result.skills
          };
        });
        invalidateWorkspace();
      },
      onError: trackMutationError('installSkill')
    })
  };
}

export function useReconciliationEvents(options?: { enabled?: boolean; organizationId?: string | null }) {
  const enabled = options?.enabled ?? true;
  return useQuery({
    queryKey: buildOsQueryKey(
      options?.organizationId ? { mode: 'workspace', organizationId: options.organizationId } : null,
      'reconciliation'
    ),
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
    refetchOnMount: false,
    refetchOnWindowFocus: false,
    enabled,
    retry: shouldRetryBffQuery
  });
}

export function useRepositoryDiscoveryMutations(options?: { queryScope?: OsQueryScope }) {
  const queryClient = useQueryClient();
  const workspaceQueryKey = buildOsQueryKey(options?.queryScope, 'workspace');
  const projectsQueryKey = buildOsQueryKey(options?.queryScope, 'projects');

  return {
    discoverRepositories: useMutation({
      mutationFn: async (integrationId: string) => {
        const response = await fetch(`/api/workspace/integrations/${integrationId}/repositories`);
        if (!response.ok) {
          const payload = await response.json().catch(() => ({}));
          throw new Error(payload.error || 'Failed to discover repositories.');
        }
        return parseJsonObject<{
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
        }>(await response.json());
      },
      onSuccess: () => {
        void queryClient.invalidateQueries({ queryKey: workspaceQueryKey });
        void queryClient.invalidateQueries({ queryKey: projectsQueryKey });
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
        const payload = parseJsonObject<{
          enabled: Array<{ id: string; externalProjectId: string; name: string }>;
          errors: Array<{ externalProjectId: string; error: string; code?: string }>;
          error?: string;
        }>(await response.json());
        if (!response.ok && !payload.enabled?.length) {
          const detail =
            payload.errors
              ?.flatMap((entry: { error?: string }) => (entry.error ? [entry.error] : []))
              .join(' ') ||
            payload.error;
          throw new Error(detail || 'Failed to enable repositories.');
        }
        return payload;
      },
      onSuccess: () => {
        trackOsEvent(CanonicalEvents.projectRegistered);
        void queryClient.invalidateQueries({ queryKey: workspaceQueryKey });
        void queryClient.invalidateQueries({ queryKey: projectsQueryKey });
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
        return parseJsonObject<Record<string, unknown>>(await response.json());
      },
      onSuccess: () => {
        void queryClient.invalidateQueries({ queryKey: workspaceQueryKey });
        void queryClient.invalidateQueries({ queryKey: projectsQueryKey });
      },
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
        return normalizeProjectRecord(await response.json());
      },
      onSuccess: () => {
        trackOsEvent(CanonicalEvents.projectRegistered);
        void queryClient.invalidateQueries({ queryKey: workspaceQueryKey });
        void queryClient.invalidateQueries({ queryKey: projectsQueryKey });
      },
      onError: trackMutationError('registerPublicRepository')
    })
  };
}

export function useAuditMutations(options?: { authStatusQuery?: OsAuthStatusQueryState | null }) {
  const queryClient = useQueryClient();
  const authStatus = options?.authStatusQuery?.data ?? null;
  const auditsQueryKey = buildOsQueryKey(authStatus, 'audits');
  const projectsQueryKey = buildOsQueryKey(authStatus, 'projects');
  const workspaceQueryKey = buildOsQueryKey(authStatus, 'workspace');

  const invalidateAuditDetail = useCallback(
    (auditId?: string | null) => {
      if (!auditId) return;
      void queryClient.invalidateQueries({
        queryKey: buildOsQueryKey(authStatus, 'audit-detail', auditId)
      });
    },
    [authStatus, queryClient]
  );

  const fetchAuditDetail = useCallback(
    async (auditId: string) => {
      return queryClient.fetchQuery<AuditRun | null>({
        queryKey: buildOsQueryKey(authStatus, 'audit-detail', auditId),
        queryFn: async () => {
          const response = await fetch(`/api/audits/${auditId}`);
          if (!response.ok) return null;
          return parseJsonObject<AuditRun>(await response.json());
        },
        staleTime: 30_000
      });
    },
    [authStatus, queryClient]
  );

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
        return normalizeProjectRecord(await response.json());
      },
      onSuccess: () => {
        trackOsEvent(CanonicalEvents.projectRegistered);
        trackOsEvent(CanonicalEvents.configValidated, { step: 'project_registered' });
        void queryClient.invalidateQueries({ queryKey: auditsQueryKey });
        void queryClient.invalidateQueries({ queryKey: projectsQueryKey });
        void queryClient.invalidateQueries({ queryKey: workspaceQueryKey });
      },
      onError: trackMutationError('registerProject')
    }),
    triggerAudit: useMutation({
      mutationFn: async (input: { projectId?: string; branch?: string }) => {
        const response = await fetch('/api/audits', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(input)
        });
        if (!response.ok) {
          const errPayload = await response.json().catch(() => ({}));
          throw new Error(errPayload.error || 'Audit run failed.');
        }
        return TriggerAuditResponseSchema.parse(await response.json());
      },
      onSuccess: (_result, variables) => {
        trackOsEvent(CanonicalEvents.auditTriggered, variables);
        void queryClient.invalidateQueries({ queryKey: auditsQueryKey });
        invalidateAuditDetail(_result.audit?.id ?? _result.auditRunId ?? null);
        void queryClient.invalidateQueries({ queryKey: projectsQueryKey });
        void queryClient.invalidateQueries({ queryKey: workspaceQueryKey });
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
        return ReviewMutationResponseSchema.parse(await response.json());
      },
      onSuccess: (_result, variables) => {
        trackOsEvent(CanonicalEvents.issueReviewed, variables);
        void queryClient.invalidateQueries({ queryKey: auditsQueryKey });
        invalidateAuditDetail(variables.auditId);
        void queryClient.invalidateQueries({ queryKey: projectsQueryKey });
        void queryClient.invalidateQueries({ queryKey: workspaceQueryKey });
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
        return ReviewMutationResponseSchema.parse(await response.json());
      },
      onSuccess: () => {
        void queryClient.invalidateQueries({ queryKey: auditsQueryKey });
        void queryClient.invalidateQueries({ queryKey: projectsQueryKey });
        void queryClient.invalidateQueries({ queryKey: workspaceQueryKey });
      },
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
        return ReviewMutationResponseSchema.parse(await response.json());
      },
      onSuccess: () => {
        void queryClient.invalidateQueries({ queryKey: auditsQueryKey });
        void queryClient.invalidateQueries({ queryKey: projectsQueryKey });
        void queryClient.invalidateQueries({ queryKey: workspaceQueryKey });
      },
      onError: trackMutationError('deployPatch')
    }),
    fetchAuditDetail
  };
}
