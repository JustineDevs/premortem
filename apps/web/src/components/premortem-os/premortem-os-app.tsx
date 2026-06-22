'use client';

import React, { useState, useEffect, Suspense, useCallback, useRef } from 'react';
import dynamic from 'next/dynamic';
import { useQueryClient } from '@tanstack/react-query';
import { Sidebar } from './Sidebar';
import { DashboardView } from './DashboardView';
import { ProjectsView } from './ProjectsView';
import { AuditsView } from './AuditsView';
import { AdHocSandboxView } from './AdHocSandboxView';
import { SettingsView } from './SettingsView';
import { AuditHistoryView } from './AuditHistoryView';
import { Project, AuditRun, ProviderType, Finding, RiskCluster } from '@/lib/premortem-os/types';
import type { RuntimeAuditSnapshot } from '@/lib/premortem-api/client';
import { ConsoleReviewAction, consoleStatusAfterReviewAction, ConsoleIssueStatus } from '@premortem/domain';
import type { ConsoleReviewActionValue } from '@premortem/domain';
import { premortemBrand } from '@/lib/premortem-os/branding';

import { useWorkspace } from '@/hooks/use-workspace';
import { useOsConsoleData, useAuditMutations } from '@/hooks/use-os-console-data';
import { useContinuousAuditCycle } from '@/hooks/use-continuous-audit-cycle';
import { usePublishedIssueSyncCycle } from '@/hooks/use-published-issue-sync-cycle';
import { OsAnalyticsIdentity, OsPageAnalytics } from './os-analytics';
import { OsLoadingScreen } from './os-loading-screen';
import { OsToast } from './os-toast';
import { OsDiagnosticBanner } from './os-diagnostic-banner';
import { resolveGitLabAccessState } from '@/lib/provider-access';
import { bffFetchJson } from '@/lib/bff-client';
import { formatIntegrationNotice } from '@/lib/integration-notices';
import { buildOsDiagnostic } from '@/lib/diagnostics';

const hasSameJson = (left: unknown, right: unknown) => JSON.stringify(left) === JSON.stringify(right);

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

export function PremortemOsApp() {
  const { workspace, patchRuntime, reload: reloadWorkspace, resumeAudit, stopAllRuntime } = useWorkspace();
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
  } = useOsConsoleData();
  const [activeTab, setActiveTab] = useState<string>('dashboard');
  const [projectsState, setProjects] = useState<Project[]>([]);
  const [audits, setAudits] = useState<AuditRun[]>([]);
  const [riskClusters, setRiskClusters] = useState<RiskCluster[]>([]);
  const [selectedAuditId, setSelectedAuditId] = useState<string | null>(null);
  const [focusCluster, setFocusCluster] = useState<RiskCluster | null>(null);
  
  const {
    registerProject,
    triggerAudit,
    reviewIssue,
    persistFindingFields: persistFindingFieldsMutation,
    deployPatch
  } = useAuditMutations();
  const [isPatching, setIsPatching] = useState<boolean>(false);
  const [isTogglingContinuousAudit, setIsTogglingContinuousAudit] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [localFixtureMode, setLocalFixtureMode] = useState(false);
  const [systemScore, setSystemScore] = useState<number>(0);
  const hasInitializedUrlStateRef = useRef(false);
  const queryClient = useQueryClient();

  const handleOpenRiskCluster = useCallback((cluster: RiskCluster) => {
    if (!cluster.auditRunId) return;
    setSelectedAuditId(cluster.auditRunId);
    setFocusCluster(cluster);
    setActiveTab('audits');
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (hasInitializedUrlStateRef.current) return;
    hasInitializedUrlStateRef.current = true;

    const params = new URLSearchParams(window.location.search);
    const auditId = params.get('audit');
    const tab = params.get('tab');
    if (
      tab === 'settings' ||
      tab === 'history' ||
      tab === 'projects' ||
      tab === 'audits' ||
      tab === 'dashboard' ||
      tab === 'canvas' ||
      tab === 'sandbox'
    ) {
      setActiveTab(tab);
    }
    if (auditId) {
      setSelectedAuditId(auditId);
      setActiveTab('audits');
    }
    const notice = params.get('integration_notice');
    const resolvedNotice = notice;

    if (resolvedNotice === 'gitlab_connected') {
      setActiveTab('projects');
      if (!params.has('discover')) {
        params.set('discover', '1');
      }
      setToastMessage(formatIntegrationNotice(resolvedNotice));
      params.delete('integration_notice');
      params.delete('integration_detail');
      const nextUrl = `${window.location.pathname}?${params.toString()}`;
      window.history.replaceState({}, '', nextUrl);
      void reloadWorkspace();
      void refetchProjects();
      return;
    }

    if (resolvedNotice) {
      const detail = params.get('integration_detail');
      setToastMessage(formatIntegrationNotice(resolvedNotice, detail));
      if (resolvedNotice === 'coming_soon') {
        setActiveTab('settings');
      }
      params.delete('integration_notice');
      params.delete('integration_detail');
      params.delete('integration_provider');
      const nextUrl = `${window.location.pathname}${params.toString() ? `?${params.toString()}` : ''}`;
      window.history.replaceState({}, '', nextUrl);
    }
  }, [reloadWorkspace, refetchProjects]);

  useEffect(() => {
    if (!hasInitializedUrlStateRef.current || typeof window === 'undefined') return;

    const params = new URLSearchParams(window.location.search);
    if (params.get('tab') !== activeTab) {
      params.set('tab', activeTab);
    }

    if (activeTab === 'audits' && selectedAuditId) {
      params.set('audit', selectedAuditId);
    } else {
      params.delete('audit');
    }

    if (activeTab !== 'projects') {
      params.delete('discover');
    }

    const nextUrl = `${window.location.pathname}${params.toString() ? `?${params.toString()}` : ''}`;
    const currentUrl = `${window.location.pathname}${window.location.search}`;
    if (nextUrl !== currentUrl) {
      window.history.replaceState({}, '', nextUrl);
    }
  }, [activeTab, selectedAuditId]);

  useEffect(() => {
    if (!toastMessage) return;
    const timer = window.setTimeout(() => setToastMessage(null), 5000);
    return () => window.clearTimeout(timer);
  }, [toastMessage]);

  const alert = useCallback((message: string) => {
    setToastMessage(message);
  }, []);

  useEffect(() => {
    setProjects((current) => (hasSameJson(current, projects) ? current : projects));
  }, [projects]);

  useEffect(() => {
    const workspaceAudits = loadedAudits.filter(
      (audit) => !audit.isSandbox && audit.projectId !== 'sandbox' && !audit.id.startsWith('sandbox-')
    );
    const auditFromUrl =
      typeof window === 'undefined'
        ? null
        : new URLSearchParams(window.location.search).get('audit');
    setAudits((current) => (hasSameJson(current, workspaceAudits) ? current : workspaceAudits));
    setRiskClusters((current) =>
      hasSameJson(current, loadedRiskClusters) ? current : (loadedRiskClusters as RiskCluster[])
    );
    if (auditFromUrl && workspaceAudits.some((audit) => audit.id === auditFromUrl)) {
      setSelectedAuditId(auditFromUrl);
      return;
    }
    if (workspaceAudits.length > 0 && !selectedAuditId) {
      setSelectedAuditId(workspaceAudits[0].id);
    }
  }, [loadedAudits, loadedRiskClusters, selectedAuditId]);

  useEffect(() => {
    void bffFetchJson<{ mode?: string }>('/api/auth/status')
      .then((payload) => setLocalFixtureMode(payload.mode === 'local_fixture'))
      .catch(() => setLocalFixtureMode(false));
  }, []);

  useEffect(() => {
    if (authError) {
      setErrorMessage(
        authError instanceof Error ? authError.message : 'Sign in to use the reviewer console.'
      );
    } else {
      setErrorMessage(null);
    }
  }, [authError]);

  useEffect(() => {
    if (!loadError || authError) return;
    setToastMessage(
      loadError instanceof Error
        ? loadError.message
        : 'Some console data failed to load. Retry from Settings or refresh the page.'
    );
  }, [loadError, authError]);

  useEffect(() => {
    const workspaceAudits = audits.filter(
      (audit) => !audit.isSandbox && audit.projectId !== 'sandbox' && !audit.id.startsWith('sandbox-')
    );
    if (workspaceAudits.length > 0) {
      const avgScore = Math.round(
        workspaceAudits.reduce((sum, current) => sum + current.score, 0) / workspaceAudits.length
      );
      setSystemScore(avgScore);
    } else {
      setSystemScore(0);
    }
  }, [audits]);

  const handleAuditHydrated = (auditId: string, hydratedAudit: AuditRun) => {
    setAudits((prev) =>
      prev.map((audit) => (audit.id === auditId ? { ...audit, ...hydratedAudit } : audit))
    );
  };

  const fetchAuditDetail = useCallback(async (auditId: string): Promise<AuditRun | null> => {
    try {
      const payload = await queryClient.fetchQuery({
        queryKey: ['os', 'audit-detail', auditId],
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
      const project = projectsState.find((item) => item.id === snapshot?.projectId);
      const { mapSnapshotToAuditRun } = await import('@/lib/premortem-api/map-runtime-to-console');
      const hydrated = mapSnapshotToAuditRun(
        snapshot,
        project?.name ?? snapshot?.projectId ?? auditId
      );
      handleAuditHydrated(auditId, hydrated);
      return hydrated;
    } catch {
      return null;
    }
  }, [projectsState, queryClient]);
  const handleRegisterProject = async (newProjPayload: {
    name: string;
    repoUrl: string;
    branch: string;
    provider: ProviderType;
    scanCodeSnippet?: string;
  }) => {
    try {
      const registered = await registerProject.mutateAsync(newProjPayload);
      setProjects((prev) => [...prev, registered]);
    } catch (err: unknown) {
      alert(`Error registering repository: ${err instanceof Error ? err.message : 'Unknown error'}`);
    }
  };

  // 4. Trigger active continuous run
  const handleTriggerScan = async (projectId: string, options?: { silent?: boolean }) => {
    // Set matching project to scanning state
    setProjects((prev) =>
      prev.map((p) => (p.id === projectId ? { ...p, status: 'SCANNING' } : p))
    );
    
    // Auto-navigate to Audits list to observe progress (manual triggers only)
    if (!options?.silent) {
      setActiveTab('audits');
    }

    try {
      const result = await triggerAudit.mutateAsync({ projectId });

      if (result.success && result.audit) {
        const newAuditRecord: AuditRun = result.audit;
        setAudits((prev) => [newAuditRecord, ...prev]);
        setSelectedAuditId(newAuditRecord.id);

        // Update corresponding project status
        setProjects((prev) =>
          prev.map((p) => {
            if (p.id === projectId) {
              const auditFindings = newAuditRecord.findings || [];
              const severeCount = auditFindings.filter(f => f.severity === 'CRITICAL' || f.severity === 'HIGH').length;
              const hasWarnings = auditFindings.filter(f => f.severity === 'MEDIUM').length > 0;
              
              let status: 'COMPLIANT' | 'WARNING' | 'FAILED' = 'COMPLIANT';
              if (severeCount > 0) status = 'FAILED';
              else if (hasWarnings) status = 'WARNING';

              return {
                ...p,
                status,
                lastAuditScore: newAuditRecord.score,
                lastAuditDate: newAuditRecord.date,
              };
            }
            return p;
          })
        );
      } else if (result.success && result.auditRunId) {
        setSelectedAuditId(String(result.auditRunId));
        setToastMessage(
          typeof result.message === 'string'
            ? result.message
            : 'Scan queued. Results appear in Audits when the run completes.'
        );
      }
      void refetchAudits();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      setToastMessage(`AI security scan failed: ${message}`);
      // Reset scanning state back to normal warning level on exception
      setProjects((prev) =>
        prev.map((p) => (p.id === projectId ? { ...p, status: 'FAILED' } : p))
      );
    }
  };

  // 5. Update Finding action (confirm / dismiss false positives)
  const handleUpdateFindingStatus = async (
    auditId: string,
    issueId: string,
    action: ConsoleReviewActionValue
  ) => {
    try {
      const data = await reviewIssue.mutateAsync({ auditId, issueId, action });

      if (data.success) {
        const nextStatus = consoleStatusAfterReviewAction(action);
        setAudits((prev) =>
          prev.map((audit) => {
            if (audit.id === auditId) {
              return {
                ...audit,
                findings: audit.findings.map((f) =>
                  f.id === issueId && nextStatus ? { ...f, status: nextStatus } : f
                )
              };
            }
            return audit;
          })
        );
      }
    } catch (err: any) {
      alert("Unable to update finding state: " + err.message);
    }
  };

  // 5b. Synthesized issue field edits (local optimistic state while editing)
  const handleUpdateFindingFields = (
    auditId: string,
    findingId: string,
    fields: Partial<Finding>
  ) => {
    setAudits((prev) =>
      prev.map((audit) => {
        if (audit.id === auditId) {
          return {
            ...audit,
            findings: audit.findings.map((f) =>
              f.id === findingId ? { ...f, ...fields } : f
            ),
          };
        }
        return audit;
      })
    );
  };

  const handlePersistFindingFields = async (
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
  };
  const handleDeployPatch = async (auditId: string, issueId: string) => {
    setIsPatching(true);
    try {
      const data = await deployPatch.mutateAsync({ auditId, issueId });
      if (data.success) {
        setAudits((prev) =>
          prev.map((audit) => {
            if (audit.id === auditId) {
              const updatedFindings = audit.findings.map((f) =>
                f.id === issueId
                  ? { ...f, status: ConsoleIssueStatus.RESOLVED, patchApplied: true }
                  : f
              );
              return { ...audit, findings: updatedFindings };
            }
            return audit;
          })
        );
      }
    } catch (err: unknown) {
      alert(`Patch deployment failed during git push routing: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setIsPatching(false);
    }
  };

  const handleAnalyzeSnippet = async (customSnippet: string) => {
    try {
      return await triggerAudit.mutateAsync({ customSnippet });
    } catch (err: unknown) {
      return { success: false, error: err instanceof Error ? err.message : 'Auditing exception.' };
    }
  };

  const continuousAuditEnabled = workspace?.runtime.continuousAuditEnabled ?? false;

  const handleTriggerScanForCycle = useCallback(
    (projectId: string) => handleTriggerScan(projectId, { silent: true }),
    [triggerAudit]
  );

  const { pipelineActive: continuousAuditPipelineActive } = useContinuousAuditCycle({
    enabled: continuousAuditEnabled,
    projects: projectsState,
    audits,
    onTriggerScan: handleTriggerScanForCycle,
    refetchAudits,
    refetchWorkspace: reloadWorkspace
  });

  const publishedIssueCount = workspace?.usage.patches.used ?? 0;
  const handlePublishedIssueReconciled = useCallback(() => {
    void refetchAudits();
  }, [refetchAudits]);

  usePublishedIssueSyncCycle({
    enabled: Boolean(workspace),
    publishedIssueCount,
    onReconciled: handlePublishedIssueReconciled
  });

  const handleToggleContinuousAudit = async () => {
    setIsTogglingContinuousAudit(true);
    try {
      await patchRuntime(!continuousAuditEnabled);
      await reloadWorkspace();
    } catch (err: unknown) {
      alert(
        `Failed to update continuous audit: ${err instanceof Error ? err.message : 'Unknown error'}`
      );
    } finally {
      setIsTogglingContinuousAudit(false);
    }
  };

  const handleStopAllRuntime = useCallback(async () => {
    await stopAllRuntime.mutateAsync();
    await Promise.all([refetchAudits(), reloadWorkspace()]);
  }, [stopAllRuntime, refetchAudits, reloadWorkspace]);

  const handleResumeAudit = useCallback(
    async (auditRunId: string) => {
      await resumeAudit.mutateAsync(auditRunId);
      await refetchAudits();
    },
    [resumeAudit, refetchAudits]
  );

  const runtimeStopAllVisible =
    continuousAuditEnabled ||
    (workspace?.runtime.runningAudits ?? 0) > 0 ||
    audits.some((audit) => audit.status === 'RUNNING');

  const gitLabAccess = resolveGitLabAccessState(workspace?.integrations);

  if (consoleLoading) {
    return <OsLoadingScreen />;
  }

  // Error wrapper screen
  if (errorMessage) {
    const diagnostic = buildOsDiagnostic(errorMessage);
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-[#FBFBFA] px-6 font-sans">
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
    <div id="layout-view" className="flex h-screen w-screen overflow-hidden bg-[#FBFBFA] text-[#1E2522]">
      <OsAnalyticsIdentity workspace={workspace} />
      <Suspense fallback={null}>
        <OsPageAnalytics />
      </Suspense>
      {/* Primary Sidebar Left Menu Navigation Row */}
      <Sidebar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        systemScore={systemScore}
        workspaceName={workspace?.organization.name}
        workspaceSlug={workspace?.organization.slug}
        runningAudits={workspace?.runtime.runningAudits}
      />

      {/* Main View Work Content Panel */}
      <main id="workspace-main" className="flex-1 overflow-hidden flex flex-col h-full bg-[#FBFBFA]">
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
            projects={projectsState}
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
            apiHealthy={apiHealthy}
            runningAudits={workspace?.runtime.runningAudits ?? 0}
            isLoading={isAuditsLoading}
            continuousAuditEnabled={continuousAuditEnabled}
            onToggleContinuousAudit={handleToggleContinuousAudit}
            isTogglingContinuousAudit={isTogglingContinuousAudit}
            continuousAuditPipelineActive={continuousAuditPipelineActive}
            onStopAllRuntime={handleStopAllRuntime}
            onResumeAudit={handleResumeAudit}
            showStopAll={runtimeStopAllVisible}
            isStopAllPending={stopAllRuntime.isPending}
            isResumePending={resumeAudit.isPending}
            gitLabConnected={gitLabAccess.phase === 'repository_access'}
            discoveredRepoCount={gitLabAccess.integration?.projectCount ?? 0}
          />
        )}

        {activeTab === 'projects' && (
          <ProjectsView
            projects={projectsState}
            gitlabIntegration={gitLabAccess.integration}
            gitlabAccessPhase={gitLabAccess.phase}
            onProjectsChanged={() => void refetchProjects()}
            onTriggerScan={handleTriggerScan}
            onRegisterProject={handleRegisterProject}
          />
        )}

        {activeTab === 'audits' && (
          <AuditsView
            audits={audits}
            selectedAuditId={selectedAuditId}
            focusCluster={focusCluster}
            onFocusClusterComplete={() => setFocusCluster(null)}
            onSelectAudit={setSelectedAuditId}
            onUpdateFindingStatus={handleUpdateFindingStatus}
            onUpdateFindingFields={handleUpdateFindingFields}
            onPersistFindingFields={handlePersistFindingFields}
            onAuditHydrated={handleAuditHydrated}
            onDeployPatch={handleDeployPatch}
            isPatching={isPatching}
            onTriggerScan={handleTriggerScan}
            onStopAllRuntime={handleStopAllRuntime}
            onResumeAudit={handleResumeAudit}
            showStopAll={runtimeStopAllVisible}
            isStopAllPending={stopAllRuntime.isPending}
            isResumePending={resumeAudit.isPending}
          />
        )}

        {activeTab === 'sandbox' && (
          <AdHocSandboxView 
            onAnalyzeSnippet={handleAnalyzeSnippet}
          />
        )}

        {activeTab === 'canvas' && (
          <WorkflowCanvasView
            projects={projectsState}
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
          <SettingsView projects={projectsState} />
        )}
      </main>
      <OsToast message={toastMessage ?? ''} />
    </div>
  );
}
