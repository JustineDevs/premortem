'use client';

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import dynamic from 'next/dynamic';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useQueryClient } from '@tanstack/react-query';
import { Sidebar } from './Sidebar';
import { DashboardView } from './DashboardView';
import { ProjectsView } from './ProjectsView';
import { AuditsView } from './AuditsView';
import { AdHocSandboxView } from './AdHocSandboxView';
import { SettingsView } from './SettingsView';
import { Project, AuditRun, ProviderType, Finding, RiskCluster, isRiskClusterArray } from '@/lib/premortem-os/types';
import type { RuntimeAuditSnapshot } from '@/lib/premortem-api/client';
import { ConsoleReviewAction, consoleStatusAfterReviewAction, ConsoleIssueStatus, scoreFromSeverityCounts } from '@premortem/domain';
import type { ConsoleReviewActionValue } from '@premortem/domain';
import { premortemBrand } from '@/lib/premortem-os/branding';

import { useWorkspace } from '@/hooks/use-workspace';
import { buildOsQueryKey, useAuthStatusQuery, useOsConsoleData, useAuditMutations } from '@/hooks/use-os-console-data';
import { useContinuousAuditCycle } from '@/hooks/use-continuous-audit-cycle';
import { OsAnalyticsIdentity } from './os-analytics';
import { OsLoadingScreen } from './os-loading-screen';
import { OsToast } from './os-toast';
import { OsDiagnosticBanner } from './os-diagnostic-banner';
import { resolveGitLabAccessState } from '@/lib/provider-access';
import { bffFetchJson } from '@/lib/bff-client';
import { formatIntegrationNotice } from '@/lib/integration-notices';
import { buildOsDiagnostic } from '@/lib/diagnostics';
import { mapSnapshotToAuditRun } from '@/lib/premortem-api/map-runtime-to-console';
import { mapSandboxResponseToAuditRun } from '@/lib/premortem-api/map-sandbox-response';
import { selectRealProject } from '@/lib/premortem-os/project-selection';
import { pickDefaultWorkflowProjectId } from '@/lib/premortem-os/merge-console-projects';

const SETTINGS_SUBTAB_IDS = [
  'profile',
  'organization',
  'integrations',
  'providers',
  'billing',
  'notifications',
  'skills'
] as const;
type SettingsSubTabId = (typeof SETTINGS_SUBTAB_IDS)[number];
type AppTab = 'dashboard' | 'projects' | 'audits' | 'canvas' | 'history' | 'settings' | 'sandbox';

function normalizeAuditIdentity(audit: AuditRun): {
  auditId: string;
  projectId: string;
  sandbox: boolean;
} {
  const auditRecord = audit as { id?: unknown; auditRunId?: unknown; projectId?: unknown; isSandbox?: unknown };
  const auditId = typeof auditRecord.id === 'string'
    ? auditRecord.id
    : typeof auditRecord.auditRunId === 'string'
      ? auditRecord.auditRunId
      : '';
  const projectId = typeof auditRecord.projectId === 'string' ? auditRecord.projectId : '';
  return {
    auditId,
    projectId,
    sandbox:
      Boolean(auditRecord.isSandbox) ||
      projectId === 'sandbox' ||
      (typeof auditId === 'string' && auditId.startsWith('sandbox-'))
  };
}

function isValidAuditId(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0 && value !== 'null' && value !== 'undefined';
}

const WorkflowCanvasView = dynamic(
  () => import('./WorkflowCanvasView').then((module) => module.WorkflowCanvasView),
  {
    loading: () => (
      <div className="flex flex-1 items-center justify-center p-8 font-mono text-xs text-[#5C6560]">
        Loading workflow canvas…
      </div>
    ),
    ssr: false
  }
);

const AuditHistoryView = dynamic(
  () => import('./AuditHistoryView').then((module) => module.AuditHistoryView),
  {
    loading: () => (
      <div className="flex flex-1 items-center justify-center p-8 font-mono text-xs text-[#5C6560]">
        Loading audit history…
      </div>
    ),
    ssr: false
  }
);

export function PremortemOsApp() {
  const authStatusQuery = useAuthStatusQuery();
  const { workspace, patchRuntime, reload: reloadWorkspace, pauseAudit, resumeAudit, stopAllRuntime } = useWorkspace({
    authStatusQuery
  });
  const {
    projects,
    audits: loadedAudits,
    riskClusters: loadedRiskClusters,
    isLoading: consoleLoading,
    isAuditsLoading,
    authError,
    loadError,
    apiHealthy,
    refetchAudits,
    refetchProjects
  } = useOsConsoleData({ authStatusQuery });
  const osQueryScope = useMemo(
    () => ({
      mode: authStatusQuery.data?.mode ?? 'unknown',
      organizationId: authStatusQuery.data?.organizationId ?? 'none'
    }),
    [authStatusQuery.data?.mode, authStatusQuery.data?.organizationId]
  );
  const audits = loadedAudits;
  const riskClusters = isRiskClusterArray(loadedRiskClusters) ? loadedRiskClusters : [];
  const [focusCluster, setFocusCluster] = useState<RiskCluster | null>(null);
  
  const {
    registerProject,
    triggerAudit,
    reviewIssue,
    persistFindingFields: persistFindingFieldsMutation,
    deployPatch
  } = useAuditMutations({ authStatusQuery });
  const [isPatching, setIsPatching] = useState<boolean>(false);
  const [isTogglingContinuousAudit, setIsTogglingContinuousAudit] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const hasInitializedUrlStateRef = useRef(false);
  const queryClient = useQueryClient();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const searchParamsString = searchParams?.toString() ?? '';
  const urlSearchParams = useMemo(
    () => new URLSearchParams(searchParamsString),
    [searchParamsString]
  );
  const safeLoadedAudits = Array.isArray(loadedAudits) ? loadedAudits : [];
  const workspaceAudits = useMemo(() => {
    const filtered = safeLoadedAudits.filter((audit) => {
      if (!audit || typeof audit !== 'object') return false;
      const normalized = normalizeAuditIdentity(audit);
      return isValidAuditId(normalized.auditId) && !normalized.sandbox;
    });

    return [...filtered].sort((left, right) => {
      const leftTime = new Date(left.date).getTime();
      const rightTime = new Date(right.date).getTime();
      if (Number.isNaN(leftTime) && Number.isNaN(rightTime)) return 0;
      if (Number.isNaN(leftTime)) return 1;
      if (Number.isNaN(rightTime)) return -1;
      return rightTime - leftTime;
    });
  }, [safeLoadedAudits]);

  const activeTab = useMemo<AppTab>(() => {
    const tab = urlSearchParams.get('tab');
    switch (tab) {
      case 'settings':
      case 'history':
      case 'projects':
      case 'audits':
      case 'dashboard':
      case 'canvas':
      case 'sandbox':
        return tab;
      case 'integrations':
        return 'settings';
      case 'playground':
        return 'sandbox';
      default:
        return 'dashboard';
    }
  }, [urlSearchParams]);

  const requestedAuditId = useMemo(() => {
    const auditId = urlSearchParams.get('audit');
    return isValidAuditId(auditId) ? auditId : null;
  }, [urlSearchParams]);

  const activeSettingsSubTab = useMemo<SettingsSubTabId>(() => {
    const tab = urlSearchParams.get('settingsTab');
    return SETTINGS_SUBTAB_IDS.includes(tab as SettingsSubTabId)
      ? (tab as SettingsSubTabId)
      : 'profile';
  }, [urlSearchParams]);

  const latestWorkspaceAudit = workspaceAudits[0] ?? null;
  const latestCompletedWorkspaceAudit = useMemo(
    () => workspaceAudits.find((audit) => audit.status === 'COMPLETED') ?? null,
    [workspaceAudits]
  );
  const complianceWorkspaceAudit = latestCompletedWorkspaceAudit ?? latestWorkspaceAudit;

  const selectedAuditId = useMemo(() => {
    if (requestedAuditId) {
      return requestedAuditId;
    }
    return latestCompletedWorkspaceAudit?.id ?? latestWorkspaceAudit?.id ?? null;
  }, [latestCompletedWorkspaceAudit?.id, latestWorkspaceAudit?.id, requestedAuditId]);

  const selectedAudit = useMemo(
    () => {
      if (requestedAuditId) {
        return audits.find((audit) => audit.id === requestedAuditId) ?? null;
      }
      return audits.find((audit) => audit.id === selectedAuditId) ?? complianceWorkspaceAudit ?? null;
    },
    [audits, complianceWorkspaceAudit, requestedAuditId, selectedAuditId]
  );
  const authErrorMessage = useMemo(() => {
    if (!authError) return null;
    return authError instanceof Error ? authError.message : 'Sign in to use the reviewer console.';
  }, [authError]);
  const loadErrorMessage = useMemo(() => {
    if (!loadError || authError) return null;
    return loadError instanceof Error
      ? loadError.message
      : 'Some console data failed to load. Retry from Settings or refresh the page.';
  }, [loadError, authError]);
  const lastLoadErrorMessageRef = useRef<string | null>(null);

  const updateUrl = useCallback(
    (
      updates: {
        tab?: string;
        audit?: string | null;
        discover?: boolean;
        clearNotice?: boolean;
        settingsTab?: SettingsSubTabId | null;
      }
    ) => {
      const params = new URLSearchParams(urlSearchParams.toString());
      if (updates.tab) {
        params.set('tab', updates.tab);
      }
      if (updates.audit !== undefined) {
        if (updates.audit) params.set('audit', updates.audit);
        else params.delete('audit');
      }
      if (updates.discover !== undefined) {
        if (updates.discover) params.set('discover', '1');
        else params.delete('discover');
      }
      if (updates.settingsTab !== undefined) {
        if (updates.settingsTab) params.set('settingsTab', updates.settingsTab);
        else params.delete('settingsTab');
      }
      if (updates.clearNotice) {
        params.delete('integration_notice');
        params.delete('integration_detail');
        params.delete('integration_provider');
      }

      const nextUrl = `${pathname}${params.toString() ? `?${params.toString()}` : ''}`;
      router.replace(nextUrl, { scroll: false });
    },
    [pathname, router, urlSearchParams]
  );

  const setActiveTab = useCallback(
    (tab: string) => {
      updateUrl({
        tab,
        audit: tab === 'audits' ? selectedAuditId : null,
        discover: tab === 'projects' ? true : false,
        settingsTab: tab === 'settings' ? activeSettingsSubTab : null
      });
    },
    [activeSettingsSubTab, selectedAuditId, updateUrl]
  );

  const setSettingsSubTab = useCallback(
    (settingsTab: SettingsSubTabId) => {
      updateUrl({
        tab: 'settings',
        settingsTab
      });
    },
    [updateUrl]
  );

  const setSelectedAuditId = useCallback(
    (auditId: string | null) => {
      updateUrl({ tab: auditId ? 'audits' : activeTab, audit: auditId });
    },
    [activeTab, updateUrl]
  );

  const handleOpenRiskCluster = useCallback((cluster: RiskCluster) => {
    if (!isValidAuditId(cluster.auditRunId)) return;
    setSelectedAuditId(cluster.auditRunId);
    setFocusCluster(cluster);
    setActiveTab('audits');
  }, [setActiveTab, setSelectedAuditId]);

  useEffect(() => {
    if (hasInitializedUrlStateRef.current) return;
    hasInitializedUrlStateRef.current = true;

    const notice = urlSearchParams.get('integration_notice');
    const resolvedNotice = notice;

    if (resolvedNotice === 'gitlab_connected') {
      setActiveTab('projects');
      setToastMessage(formatIntegrationNotice(resolvedNotice));
      updateUrl({ tab: 'projects', discover: true, clearNotice: true });
      void reloadWorkspace();
      void refetchProjects();
      return;
    }

    if (resolvedNotice) {
      const detail = urlSearchParams.get('integration_detail');
      setToastMessage(formatIntegrationNotice(resolvedNotice, detail));
      if (resolvedNotice === 'coming_soon') {
        setActiveTab('settings');
      }
      updateUrl({ clearNotice: true });
    }
  }, [reloadWorkspace, refetchProjects, searchParamsString, setActiveTab, updateUrl, urlSearchParams]);

  useEffect(() => {
    if (!toastMessage) return;
    const timer = window.setTimeout(() => setToastMessage(null), 5000);
    return () => window.clearTimeout(timer);
  }, [toastMessage]);

  useEffect(() => {
    if (!loadErrorMessage) return;
    if (lastLoadErrorMessageRef.current === loadErrorMessage) return;
    lastLoadErrorMessageRef.current = loadErrorMessage;
    setToastMessage(loadErrorMessage);
  }, [loadErrorMessage]);

  const systemScore = useMemo(() => {
    if (!complianceWorkspaceAudit) return 0;
    return scoreFromSeverityCounts({
      critical: complianceWorkspaceAudit.criticalCount ?? 0,
      high: complianceWorkspaceAudit.highCount ?? 0,
      medium: complianceWorkspaceAudit.mediumCount ?? 0,
      low: complianceWorkspaceAudit.lowCount ?? 0
    });
  }, [complianceWorkspaceAudit]);

  const handleAuditHydrated = useCallback(
    (auditId: string, hydratedAudit: AuditRun) => {
      queryClient.setQueryData<{ audits: AuditRun[]; riskClusters: unknown[] } | AuditRun[]>(
        buildOsQueryKey(osQueryScope, 'audits'),
        (current) => {
          const updateAudit = (audit: AuditRun) =>
            audit.id === auditId
              ? {
                  ...audit,
                  ...hydratedAudit,
                  date: audit.date ?? hydratedAudit.date
                }
              : audit;

          if (Array.isArray(current)) {
            return current.map(updateAudit);
          }

          if (!current) {
            return current;
          }

          return {
            ...current,
            audits: current.audits.map(updateAudit)
          };
        }
      );
    },
    [osQueryScope, queryClient]
  );

  const fetchAuditDetail = useCallback(async (auditId: string): Promise<AuditRun | null> => {
    try {
      const payload = await queryClient.fetchQuery({
        queryKey: buildOsQueryKey(osQueryScope, 'audit-detail', auditId),
        staleTime: 60_000,
        queryFn: async () => {
          const res = await fetch(`/api/audits/${auditId}?hydrate=0`, { cache: 'no-store' });
          if (!res.ok) {
            const { readBffErrorMessage } = await import('@/lib/bff-client');
            throw new Error(await readBffErrorMessage(res, 'Failed to load audit detail.'));
          }
          return res.json() as Promise<{
            snapshot?: RuntimeAuditSnapshot | null;
            auditRun?: RuntimeAuditSnapshot | null;
          }>;
        }
      });
      const snapshot = payload.snapshot ?? payload.auditRun;
      if (!snapshot) return null;
      const project = projects.find((item: Project) => item.id === snapshot?.projectId);
      const { mapSnapshotToAuditRun } = await import('@/lib/premortem-api/map-runtime-to-console');
      const hydrated = mapSnapshotToAuditRun(
        snapshot,
        project?.name ?? snapshot?.projectId ?? auditId,
        audits.find((item: AuditRun) => item.id === auditId)?.date
      );
      handleAuditHydrated(auditId, hydrated);
      return hydrated;
    } catch {
      return null;
    }
  }, [audits, handleAuditHydrated, osQueryScope, projects, queryClient]);
  const handleRegisterProject = useCallback(async (newProjPayload: {
    name: string;
    repoUrl: string;
    branch: string;
    provider: ProviderType;
    scanCodeSnippet?: string;
  }) => {
    try {
      await registerProject.mutateAsync(newProjPayload);
    } catch (err: unknown) {
      setToastMessage(
        `Error registering repository: ${err instanceof Error ? err.message : 'Unknown error'}`
      );
    }
  }, [registerProject]);

  // 4. Trigger active continuous run
  const handleTriggerScan = useCallback(
    async (projectId: string, options?: { silent?: boolean }) => {
      // Auto-navigate to Audits list to observe progress (manual triggers only)
      if (!options?.silent) {
        setActiveTab('audits');
      }

      try {
        const project = projects.find((item) => item.id === projectId);
        const result = await triggerAudit.mutateAsync({
          projectId,
          branch: project?.branch ?? 'main'
        });

        void refetchAudits();

        if (result.success && result.audit) {
          const newAuditRecord: AuditRun = result.audit;
          queryClient.setQueryData<{ audits: AuditRun[]; riskClusters: unknown[] } | AuditRun[]>(
            buildOsQueryKey(osQueryScope, 'audits'),
            (current) => {
              if (Array.isArray(current)) return [newAuditRecord, ...current];
              if (!current) return current;
              return { ...current, audits: [newAuditRecord, ...current.audits] };
            }
          );
          updateUrl({ tab: 'audits', audit: newAuditRecord.id });
        } else if (result.success && isValidAuditId(result.auditRunId)) {
          updateUrl({ tab: 'audits', audit: String(result.auditRunId) });
          setToastMessage(
            typeof result.message === 'string'
              ? result.message
              : 'Scan queued. Results appear in Audits when the run completes.'
          );
        }
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Unknown error';
        setToastMessage(`AI security scan failed: ${message}`);
      }
    },
    [osQueryScope, queryClient, refetchAudits, setActiveTab, setToastMessage, triggerAudit, updateUrl]
  );

  const handleStartAuditFromRuntime = useCallback(async () => {
    const projectId =
      pickDefaultWorkflowProjectId(projects, audits) ??
      selectRealProject(projects, selectedAudit?.projectId)?.id;
    if (!projectId) {
      setToastMessage('Register a project first, then start an audit.');
      setActiveTab('projects');
      return;
    }

    await handleTriggerScan(projectId);
  }, [audits, handleTriggerScan, projects, selectedAudit?.projectId, setActiveTab]);

  // 5. Update Finding action (confirm / dismiss false positives)
  const handleUpdateFindingStatus = useCallback(async (
    auditId: string,
    issueId: string,
    action: ConsoleReviewActionValue
  ) => {
    try {
      const data = await reviewIssue.mutateAsync({ auditId, issueId, action });

      if (data.success) {
        const nextStatus = consoleStatusAfterReviewAction(action);
        queryClient.setQueryData<{ audits: AuditRun[]; riskClusters: unknown[] } | AuditRun[]>(
          buildOsQueryKey(osQueryScope, 'audits'),
          (current) => {
            const updateAudit = (audit: AuditRun) =>
              audit.id === auditId
                ? {
                    ...audit,
                    findings: audit.findings.map((f) =>
                      f.id === issueId && nextStatus ? { ...f, status: nextStatus } : f
                    )
                  }
                : audit;

            if (Array.isArray(current)) {
              return current.map(updateAudit);
            }

            if (!current) {
              return current;
            }

            return {
              ...current,
              audits: current.audits.map(updateAudit)
            };
          }
        );
      }
    } catch (err: unknown) {
      setToastMessage(
        `Unable to update finding state: ${err instanceof Error ? err.message : String(err)}`
      );
    }
  }, [osQueryScope, queryClient, reviewIssue]);

  // 5b. Synthesized issue field edits (local optimistic state while editing)
  const handleUpdateFindingFields = useCallback((
    auditId: string,
    findingId: string,
    fields: Partial<Finding>
  ) => {
    queryClient.setQueryData<{ audits: AuditRun[]; riskClusters: unknown[] } | AuditRun[]>(
      buildOsQueryKey(osQueryScope, 'audits'),
      (current) => {
        const updateAudit = (audit: AuditRun) =>
          audit.id === auditId
            ? {
                ...audit,
                findings: audit.findings.map((f) =>
                  f.id === findingId ? { ...f, ...fields } : f
                )
              }
            : audit;

        if (Array.isArray(current)) {
          return current.map(updateAudit);
        }

        if (!current) {
          return current;
        }

        return {
          ...current,
          audits: current.audits.map(updateAudit)
        };
      }
    );
  }, [osQueryScope, queryClient]);

  const handlePersistFindingFields = useCallback(async (
    auditId: string,
    findingId: string,
    fields: Partial<Finding>
  ) => {
    handleUpdateFindingFields(auditId, findingId, fields);

    const payload = {
      title: fields.title,
      whyItMatters: fields.whyItMatters,
      description: fields.description,
      recommendedActionSummary: fields.recommendation
    };

    const hasPayload = Object.values(payload).some(
      (value) => typeof value === 'string' && value.length > 0
    );
    if (!hasPayload) return;

    await persistFindingFieldsMutation.mutateAsync({
      auditId,
      findingId,
      fields: {
        title: fields.title,
        whyItMatters: fields.whyItMatters,
        description: fields.description,
        recommendation: fields.recommendation
      }
    });
  }, [handleUpdateFindingFields, persistFindingFieldsMutation]);

  const handleDeployPatch = useCallback(async (auditId: string, issueId: string) => {
    setIsPatching(true);
    try {
      const data = await deployPatch.mutateAsync({ auditId, issueId });
      if (data.success) {
        queryClient.setQueryData<{ audits: AuditRun[]; riskClusters: unknown[] } | AuditRun[]>(
          buildOsQueryKey(osQueryScope, 'audits'),
          (current) => {
            const updateAudit = (audit: AuditRun) => {
              if (audit.id !== auditId) return audit;
              const updatedFindings = audit.findings.map((f) =>
                f.id === issueId ? { ...f, status: ConsoleIssueStatus.RESOLVED, patchApplied: true } : f
              );
              return { ...audit, findings: updatedFindings };
            };

            if (Array.isArray(current)) {
              return current.map(updateAudit);
            }

            if (!current) {
              return current;
            }

            return {
              ...current,
              audits: current.audits.map(updateAudit)
            };
          }
        );
      }
    } catch (err: unknown) {
      setToastMessage(
        `Patch deployment failed during git push routing: ${err instanceof Error ? err.message : 'Unknown error'}`
      );
    } finally {
      setIsPatching(false);
    }
  }, [deployPatch, osQueryScope, queryClient]);

  const handleAnalyzeSnippet = useCallback(async (customSnippet: string, projectId?: string) => {
    try {
      const resolvedProjectId =
        projectId ??
        pickDefaultWorkflowProjectId(projects, audits) ??
        selectRealProject(projects)?.id;
      const response = await fetch('/api/audits/sandbox', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customSnippet,
          projectId: resolvedProjectId
        })
      });

      const payload = (await response.json().catch(() => null)) as
        | {
            success?: boolean;
            sandbox?: boolean;
            overallScore?: number;
            findings?: unknown;
            generatedAt?: string;
            projectId?: string;
            projectName?: string;
            projectBranch?: string;
            error?: string;
          }
        | null;

      if (!response.ok || !payload?.success) {
        return {
          success: false,
          error: payload?.error || 'Sandbox analysis failed.'
        };
      }

      const projectName =
        payload.projectName ??
        projects.find((project: Project) => project.id === payload.projectId)?.name ??
        'Sandbox';
      const audit = mapSandboxResponseToAuditRun({
        projectId: payload.projectId ?? resolvedProjectId ?? 'sandbox',
        projectName,
        overallScore: typeof payload.overallScore === 'number' ? payload.overallScore : 100,
        findings: Array.isArray(payload.findings) ? (payload.findings as never[]) : [],
        generatedAt: payload.generatedAt
      });

      return {
        success: true,
        audit
      };
    } catch (err: unknown) {
      return { success: false, error: err instanceof Error ? err.message : 'Auditing exception.' };
    }
  }, [audits, projects]);

  const continuousAuditEnabled = workspace?.runtime.continuousAuditEnabled ?? false;

  const handleTriggerScanForCycle = useCallback(
    (projectId: string) => handleTriggerScan(projectId, { silent: true }),
    [handleTriggerScan]
  );

  const { pipelineActive: continuousAuditPipelineActive } = useContinuousAuditCycle({
    enabled: continuousAuditEnabled,
    projects,
    audits,
    onTriggerScan: handleTriggerScanForCycle,
    refetchAudits,
    refetchWorkspace: reloadWorkspace
  });

  const handleToggleContinuousAudit = useCallback(async () => {
    setIsTogglingContinuousAudit(true);
    try {
      await patchRuntime(!continuousAuditEnabled);
    } catch (err: unknown) {
      setToastMessage(
        `Failed to update continuous audit: ${err instanceof Error ? err.message : 'Unknown error'}`
      );
    } finally {
      setIsTogglingContinuousAudit(false);
    }
  }, [continuousAuditEnabled, patchRuntime]);

  const handleStopAllRuntime = useCallback(async () => {
    try {
      await stopAllRuntime.mutateAsync();
    } catch (err: unknown) {
      setToastMessage(
        `Failed to stop all runtime: ${err instanceof Error ? err.message : 'Unknown error'}`
      );
    }
  }, [stopAllRuntime]);

  const handleResumeAudit = useCallback(
    async (auditRunId: string) => {
      await resumeAudit.mutateAsync(auditRunId);
    },
    [resumeAudit]
  );

  const runtimeStopAllVisible =
    (workspace?.profile.role === 'owner' || workspace?.profile.role === 'admin') &&
    ((workspace?.runtime.runningAudits ?? 0) > 0 ||
      audits.some(
        (audit) => audit.status === 'RUNNING' || audit.status === 'PAUSED' || audit.status === 'QUEUED'
      ));

  const runtimeModeLabel = continuousAuditEnabled ? 'Continuous' : 'Manual';

  const handlePauseAudit = useCallback(
    async (auditRunId: string) => {
      await pauseAudit.mutateAsync(auditRunId);
    },
    [pauseAudit]
  );

  const gitLabAccess = useMemo(() => resolveGitLabAccessState(workspace?.integrations), [workspace?.integrations]);
  const localFixtureMode = authStatusQuery.data?.mode === 'local_fixture';

  const errorMessage = authErrorMessage;

  if (consoleLoading) {
    return <OsLoadingScreen />;
  }

  // Error wrapper screen
  if (errorMessage) {
    const diagnostic = buildOsDiagnostic(errorMessage);
    return (
      <div className="flex min-h-dvh w-full items-center justify-center bg-[#FBFBFA] px-6 font-sans">
        <div className="w-full max-w-2xl space-y-4">
          <OsDiagnosticBanner diagnostic={diagnostic} />
          <div className="flex flex-wrap items-center justify-between gap-3 px-1 text-[10px] font-mono uppercase tracking-[0.24em] text-[#717A75]">
            <span>{premortemBrand.errorTitle}</span>
            <a
              href={`mailto:${premortemBrand.supportEmail}`}
              className="text-[#5C6560] underline-offset-2 hover:text-[#1E2522] hover:underline"
            >
              {premortemBrand.errorSupportLabel}
            </a>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      id="layout-view"
      className="grid min-h-dvh w-full grid-rows-[auto_minmax(0,1fr)] overflow-x-hidden bg-[#FBFBFA] text-[#1E2522] lg:grid-cols-[16rem_minmax(0,1fr)] lg:grid-rows-1"
    >
      <OsAnalyticsIdentity workspace={workspace} />
      {/* Primary Sidebar Left Menu Navigation Row */}
      <Sidebar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        systemScore={systemScore}
        workspaceName={workspace?.organization.name}
        workspaceSlug={workspace?.organization.slug}
        runningAudits={workspace?.runtime.runningAudits}
        apiHealthy={apiHealthy}
        continuousAuditEnabled={continuousAuditEnabled}
        onToggleContinuousAudit={handleToggleContinuousAudit}
        isTogglingContinuousAudit={isTogglingContinuousAudit}
        continuousAuditPipelineActive={continuousAuditPipelineActive}
        runtimeModeLabel={runtimeModeLabel}
      />

      {/* Main View Work Content Panel */}
      <main id="workspace-main" className="flex min-h-0 min-w-0 flex-col overflow-x-hidden bg-[#FBFBFA]">
        {localFixtureMode ? (
          <div className="shrink-0 border-b border-amber-200 bg-amber-50 px-4 py-2 text-[11px] text-amber-950">
            Local development mode is active (auth bypass). Use Supabase sign-in for configured environments at{' '}
            <a href={`${premortemBrand.siteUrl}/signup`} className="font-semibold underline underline-offset-2">
              {premortemBrand.domain}/signup
            </a>{' '}
            or clone the repo and configure `.env.local` without `PREMORTEM_AUTH_DISABLED`.
          </div>
        ) : null}
        {activeTab === 'dashboard' && (
          <DashboardView 
            queryScope={osQueryScope}
            projects={projects}
            audits={audits}
            riskClusters={riskClusters}
            onTriggerScan={handleTriggerScan}
            onSelectAudit={(auditId) => {
              setSelectedAuditId(auditId);
              setActiveTab('audits');
            }}
            onOpenRiskCluster={handleOpenRiskCluster}
            onNavigateTab={setActiveTab}
            systemScore={systemScore}
            runningAudits={workspace?.runtime.runningAudits ?? 0}
            isLoading={isAuditsLoading}
            onStartAudit={handleStartAuditFromRuntime}
            onPauseAudit={handlePauseAudit}
            onStopAllRuntime={handleStopAllRuntime}
            onResumeAudit={handleResumeAudit}
            showStopAll={runtimeStopAllVisible}
            isStartAuditPending={triggerAudit.isPending}
            isPausePending={pauseAudit.isPending}
            isStopAllPending={stopAllRuntime.isPending}
            isResumePending={resumeAudit.isPending}
            gitLabConnected={gitLabAccess.phase === 'repository_access'}
            discoveredRepoCount={gitLabAccess.integration?.projectCount ?? 0}
          />
        )}

        {activeTab === 'projects' && (
          <ProjectsView
            queryScope={osQueryScope}
            projects={projects}
            gitlabIntegration={gitLabAccess.integration}
            gitlabAccessPhase={gitLabAccess.phase}
            onProjectsChanged={() => void refetchProjects()}
            onTriggerScan={handleTriggerScan}
            onRegisterProject={handleRegisterProject}
          />
        )}

        {activeTab === 'audits' && (
          <AuditsView
            queryScope={osQueryScope}
            audits={audits}
            selectedAuditId={selectedAuditId}
            focusCluster={focusCluster}
            onSelectAudit={setSelectedAuditId}
            onUpdateFindingStatus={handleUpdateFindingStatus}
            onUpdateFindingFields={handleUpdateFindingFields}
            onPersistFindingFields={handlePersistFindingFields}
            onAuditHydrated={handleAuditHydrated}
            onDeployPatch={handleDeployPatch}
            isPatching={isPatching}
            onTriggerScan={handleTriggerScan}
            runtimeModeLabel={runtimeModeLabel}
            onStartAudit={handleStartAuditFromRuntime}
            onPauseAudit={handlePauseAudit}
            onStopAllRuntime={handleStopAllRuntime}
            onResumeAudit={handleResumeAudit}
            showStopAll={runtimeStopAllVisible}
            isStartAuditPending={triggerAudit.isPending}
            isPausePending={pauseAudit.isPending}
            isStopAllPending={stopAllRuntime.isPending}
            isResumePending={resumeAudit.isPending}
          />
        )}

        {activeTab === 'sandbox' && (
          <AdHocSandboxView
            projects={projects}
            onAnalyzeSnippet={handleAnalyzeSnippet}
          />
        )}

        {activeTab === 'canvas' && (
          <WorkflowCanvasView
            queryScope={osQueryScope}
            projects={projects}
            projectsLoading={consoleLoading}
            audits={audits}
            providerConnected={gitLabAccess.phase === 'repository_access'}
            onTriggerScan={handleTriggerScan}
            setActiveTab={setActiveTab}
          />
        )}

        {activeTab === 'history' && (
          <AuditHistoryView
            audits={audits}
            onFetchAuditDetail={fetchAuditDetail}
            onSelectAudit={(auditId) => {
              setSelectedAuditId(auditId);
              setActiveTab('audits');
            }}
            setActiveTab={setActiveTab}
          />
        )}

        {activeTab === 'settings' && (
          <SettingsView
            key={workspace?.organization.id ?? 'settings-shell'}
            queryScope={osQueryScope}
            projects={projects}
            activeSubTab={activeSettingsSubTab}
            onActiveSubTabChange={setSettingsSubTab}
          />
        )}
      </main>
      <OsToast message={toastMessage ?? ''} />
    </div>
  );
}
