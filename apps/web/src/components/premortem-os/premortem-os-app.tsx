'use client';

import React, { useState, useEffect, Suspense, useCallback } from 'react';
import dynamic from 'next/dynamic';
import { Sidebar } from './Sidebar';
import { DashboardView } from './DashboardView';
import { ProjectsView } from './ProjectsView';
import { AuditsView } from './AuditsView';
import { AdHocSandboxView } from './AdHocSandboxView';
import { SettingsView } from './SettingsView';
import { AuditHistoryView } from './AuditHistoryView';
import { Project, AuditRun, ProviderType, Finding, RiskCluster } from '@/lib/premortem-os/types';
import { ConsoleReviewAction, consoleStatusAfterReviewAction, ConsoleIssueStatus } from '@premortem/domain';
import type { ConsoleReviewActionValue } from '@premortem/domain';
import { premortemBrand } from '@/lib/premortem-os/branding';
import { AlertCircle } from 'lucide-react';

import { useWorkspace } from '@/hooks/use-workspace';
import { useOsConsoleData, useAuditMutations } from '@/hooks/use-os-console-data';
import { useContinuousAuditCycle } from '@/hooks/use-continuous-audit-cycle';
import { OsAnalyticsIdentity, OsPageAnalytics } from './os-analytics';
import { OsLoadingScreen } from './os-loading-screen';
import { resolveGitLabAccessState } from '@/lib/provider-access';

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
    error: consoleError,
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
  const [systemScore, setSystemScore] = useState<number>(0);

  const handleOpenRiskCluster = useCallback((cluster: RiskCluster) => {
    if (cluster.id === 'runtime-empty') {
      setActiveTab('audits');
      return;
    }
    if (!cluster.auditRunId) return;
    setSelectedAuditId(cluster.auditRunId);
    setFocusCluster(cluster);
    setActiveTab('audits');
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    const tab = params.get('tab');
    if (tab === 'settings' || tab === 'history' || tab === 'projects' || tab === 'audits' || tab === 'dashboard') {
      setActiveTab(tab);
    }
    const notice = params.get('integration_notice');
    if (notice === 'gitlab_connected') {
      setActiveTab('projects');
      if (!params.has('discover')) {
        params.set('discover', '1');
      }
      params.delete('integration_notice');
      params.delete('integration_detail');
      const nextUrl = `${window.location.pathname}?${params.toString()}`;
      window.history.replaceState({}, '', nextUrl);
      void reloadWorkspace();
      void refetchProjects();
    }
  }, [reloadWorkspace, refetchProjects]);

  useEffect(() => {
    setProjects(projects);
  }, [projects]);

  useEffect(() => {
    setAudits(loadedAudits);
    setRiskClusters(loadedRiskClusters as RiskCluster[]);
    if (loadedAudits.length > 0 && !selectedAuditId) {
      setSelectedAuditId(loadedAudits[0].id);
    }
  }, [loadedAudits, loadedRiskClusters, selectedAuditId]);

  useEffect(() => {
    if (consoleError) {
      setErrorMessage(consoleError instanceof Error ? consoleError.message : 'Failed to connect to Premortem runtime API.');
    }
  }, [consoleError]);

  useEffect(() => {
    if (audits.length > 0) {
      const avgScore = Math.round(audits.reduce((sum, current) => sum + current.score, 0) / audits.length);
      setSystemScore(avgScore);
    }
  }, [audits]);

  const handleAuditHydrated = (auditId: string, hydratedAudit: AuditRun) => {
    setAudits((prev) =>
      prev.map((audit) => (audit.id === auditId ? { ...audit, ...hydratedAudit } : audit))
    );
  };

  const fetchAuditDetail = async (auditId: string): Promise<AuditRun | null> => {
    try {
      const res = await fetch(`/api/audits/${auditId}`);
      if (!res.ok) return null;
      const payload = await res.json();
      const project = projectsState.find((item) => item.id === payload.snapshot?.projectId);
      const { mapSnapshotToAuditRun } = await import('@/lib/premortem-api/map-runtime-to-console');
      const hydrated = mapSnapshotToAuditRun(
        payload.snapshot,
        project?.name ?? payload.snapshot?.projectId ?? auditId
      );
      handleAuditHydrated(auditId, hydrated);
      return hydrated;
    } catch {
      return null;
    }
  };
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
      }
      void refetchAudits();
    } catch (err: any) {
      alert("AI Security Scan Failed: " + err.message);
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
    audits.some((audit) => audit.status === 'RUNNING' || audit.status === 'PAUSED');

  const gitLabAccess = resolveGitLabAccessState(workspace?.integrations);

  if (consoleLoading) {
    return <OsLoadingScreen />;
  }

  // Error wrapper screen
  if (errorMessage) {
    return (
      <div className="w-screen h-screen bg-[#FBFBFA] flex items-center justify-center font-sans px-6">
        <div className="max-w-md p-6 border border-rose-200 bg-rose-50 text-xs rounded text-rose-800 space-y-4 shadow-sm">
          <div className="flex gap-2 items-center font-display font-semibold uppercase text-[10px] tracking-wider text-rose-800">
            <AlertCircle size={14} className="text-rose-600 animate-pulse" />
            <span>{premortemBrand.errorTitle}</span>
          </div>
          <p className="leading-relaxed">{errorMessage}</p>
          <div className="pt-2 border-t border-rose-100 flex gap-2 font-mono text-[9px]">
            <span>CODE: INTERFACE_CONNECT_TIMEOUT</span>
            <a
              href={`mailto:${premortemBrand.supportEmail}`}
              className="ml-auto text-zinc-500 hover:text-rose-900 underline-offset-2 hover:underline"
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
            isLoading={consoleLoading}
            continuousAuditEnabled={continuousAuditEnabled}
            onToggleContinuousAudit={handleToggleContinuousAudit}
            isTogglingContinuousAudit={isTogglingContinuousAudit}
            continuousAuditPipelineActive={continuousAuditPipelineActive}
            onStopAllRuntime={handleStopAllRuntime}
            onResumeAudit={handleResumeAudit}
            showStopAll={runtimeStopAllVisible}
            isStopAllPending={stopAllRuntime.isPending}
            isResumePending={resumeAudit.isPending}
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
            audits={audits}
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
    </div>
  );
}
