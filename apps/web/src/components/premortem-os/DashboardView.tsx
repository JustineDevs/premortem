'use client';

import React, { useState } from 'react';
import { premortemBrand } from '@/lib/premortem-os/branding';
import { 
  Project, 
  AuditRun, 
  RiskCluster 
} from '@/lib/premortem-os/types';
import { 
  ShieldCheck, 
  ShieldAlert, 
  RefreshCw, 
  Radio,
  ArrowUpRight,
  TrendingUp,
  ChevronDown,
  ChevronUp
} from 'lucide-react';
import { OsTableSkeleton } from './os-skeleton';
import { AuditRuntimeConsole } from './audit-runtime-console';
import { ContinuousAuditLockToggle } from './continuous-audit-lock-toggle';

const CLUSTER_PREVIEW_COUNT = 3;
const AUDIT_PREVIEW_COUNT = 5;
const PROJECT_PREVIEW_COUNT = 4;

interface DashboardViewProps {
  projects: Project[];
  audits: AuditRun[];
  riskClusters: RiskCluster[];
  onTriggerScan: (projectId: string) => void;
  onSelectAudit: (auditId: string) => void;
  onOpenRiskCluster?: (cluster: RiskCluster) => void;
  onNavigateTab?: (tab: string) => void;
  systemScore: number;
  apiHealthy?: boolean | null;
  runningAudits?: number;
  isLoading?: boolean;
  continuousAuditEnabled?: boolean;
  onToggleContinuousAudit?: () => void;
  isTogglingContinuousAudit?: boolean;
  continuousAuditPipelineActive?: boolean;
  onStopAllRuntime?: () => void | Promise<void>;
  onResumeAudit?: (auditId: string) => void | Promise<void>;
  showStopAll?: boolean;
  isStopAllPending?: boolean;
  isResumePending?: boolean;
  gitLabConnected?: boolean;
  discoveredRepoCount?: number;
}

function SeeMoreButton({
  expanded,
  hiddenCount,
  onToggle,
  onNavigate,
  navigateLabel,
  tone = 'light'
}: {
  expanded: boolean;
  hiddenCount: number;
  onToggle?: () => void;
  onNavigate?: () => void;
  navigateLabel?: string;
  tone?: 'light' | 'dark';
}) {
  if (hiddenCount <= 0 && !navigateLabel) return null;

  const primaryClass =
    tone === 'dark'
      ? 'text-[#72C8AF] hover:text-white'
      : 'text-emerald-900 hover:text-emerald-950';
  const secondaryClass =
    tone === 'dark' ? 'text-[#A6BCB4] hover:text-white' : 'text-[#5C6560] hover:text-emerald-900';

  return (
    <div className={`pt-3 flex items-center justify-between ${tone === 'light' ? 'border-t border-[#EAE6DF]/60 mt-4' : 'mt-2'}`}>
      {hiddenCount > 0 && onToggle ? (
        <button
          type="button"
          onClick={onToggle}
          className={`inline-flex items-center gap-1.5 text-[11px] font-mono font-bold uppercase tracking-wider transition-colors ${primaryClass}`}
        >
          {expanded ? (
            <>
              <ChevronUp size={14} />
              Show less
            </>
          ) : (
            <>
              <ChevronDown size={14} />
              See more ({hiddenCount})
            </>
          )}
        </button>
      ) : (
        <span />
      )}
      {onNavigate && navigateLabel ? (
        <button
          type="button"
          onClick={onNavigate}
          className={`inline-flex items-center gap-1 text-[11px] font-mono font-bold uppercase tracking-wider transition-colors ${secondaryClass}`}
        >
          {navigateLabel}
          <ArrowUpRight size={12} />
        </button>
      ) : null}
    </div>
  );
}

export function DashboardView({ 
  projects, 
  audits, 
  riskClusters,
  onTriggerScan, 
  onSelectAudit,
  onOpenRiskCluster,
  onNavigateTab,
  systemScore,
  apiHealthy = null,
  runningAudits = 0,
  isLoading = false,
  continuousAuditEnabled = false,
  onToggleContinuousAudit,
  isTogglingContinuousAudit = false,
  continuousAuditPipelineActive = false,
  onStopAllRuntime,
  onResumeAudit,
  showStopAll = false,
  isStopAllPending = false,
  isResumePending = false,
  gitLabConnected = false,
  discoveredRepoCount = 0
}: DashboardViewProps) {
  const safeProjects = Array.isArray(projects) ? projects : [];
  const safeAudits = Array.isArray(audits) ? audits : [];
  const safeRiskClusters = Array.isArray(riskClusters) ? riskClusters : [];
  const [clustersExpanded, setClustersExpanded] = useState(false);
  const [projectsExpanded, setProjectsExpanded] = useState(false);
  const [monitorSnapshot, setMonitorSnapshot] = useState<{
    agentRuns: Array<{ agentName: string; status: string; startedAt?: string | null }>;
    events: Array<{ eventType: string; actor: string; createdAt: string }>;
    summary?: unknown;
  } | null>(null);

  const monitorAudit =
    safeAudits.find((audit) => audit.status === 'RUNNING') ??
    safeAudits.find((audit) => audit.status === 'PAUSED') ??
    safeAudits.find((audit) => audit.status === 'COMPLETED') ??
    safeAudits[0];

  React.useEffect(() => {
    if (!monitorAudit?.id) {
      setMonitorSnapshot(null);
      return;
    }

    let cancelled = false;

    const loadSnapshot = () => {
      void fetch(`/api/audits/${monitorAudit.id}?hydrate=0`)
        .then((response) => response.json())
        .then((payload) => {
          const snapshot = payload.snapshot ?? payload.auditRun;
          if (cancelled || !snapshot) return;
          setMonitorSnapshot({
            agentRuns: snapshot.agentRuns ?? [],
            events: snapshot.events ?? [],
            summary: snapshot.summary
          });
        })
        .catch(() => {
          if (!cancelled) setMonitorSnapshot(null);
        });
    };

    loadSnapshot();

    if (monitorAudit.status !== 'RUNNING' && monitorAudit.status !== 'PAUSED') {
      return () => {
        cancelled = true;
      };
    }

    const timer = window.setInterval(loadSnapshot, 2000);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [monitorAudit?.id, monitorAudit?.status]);
  
  const totalAuditsCount = safeAudits.filter((a) => a.status === 'COMPLETED').length;
  const recentAudit = safeAudits.find((a) => a.status === 'COMPLETED');
  
  const totalFindingsCount = safeAudits.reduce((sum, current) => {
    return sum + (current.findings?.length || 0);
  }, 0);

  const stats = {
    critical: safeAudits.reduce((sum, item) => sum + (item.criticalCount || 0), 0),
    high: safeAudits.reduce((sum, item) => sum + (item.highCount || 0), 0),
    medium: safeAudits.reduce((sum, item) => sum + (item.mediumCount || 0), 0),
    low: safeAudits.reduce((sum, item) => sum + (item.lowCount || 0), 0),
  };

  const clustersToShow: RiskCluster[] = safeRiskClusters;
  const hasRealClusters = clustersToShow.length > 0;
  const workspaceEmpty = safeProjects.length === 0 && safeAudits.length === 0 && !isLoading;

  const visibleClusters = clustersExpanded
    ? clustersToShow
    : clustersToShow.slice(0, CLUSTER_PREVIEW_COUNT);

  const visibleProjects = projectsExpanded
    ? safeProjects
    : safeProjects.slice(0, PROJECT_PREVIEW_COUNT);

  const visibleAudits = safeAudits.slice(0, AUDIT_PREVIEW_COUNT);
  const activeAuditCount = safeAudits.filter(
    (audit) => audit.status === 'RUNNING'
  ).length;
  const activeRuntimeCount = Math.max(runningAudits, activeAuditCount);
  const pausedAuditCount = safeAudits.filter((audit) => audit.status === 'PAUSED').length;
  const runtimeStatusLabel =
    activeRuntimeCount > 0
      ? activeRuntimeCount === 1
        ? 'AUDIT IN PROGRESS'
        : `${activeRuntimeCount} AUDITS RUNNING`
      : pausedAuditCount > 0
        ? pausedAuditCount === 1
          ? 'AUDIT PAUSED'
          : `${pausedAuditCount} AUDITS PAUSED`
        : 'IDLE';

  return (
    <div className="flex-1 overflow-y-auto p-8 font-sans space-y-8 max-w-7xl mx-auto w-full">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center border-b border-[#EAE6DF] pb-6 gap-4">
        <div>
          <span className="text-[10px] uppercase tracking-widest font-mono text-[#8A958F]">
            Continuous Infrastructure Audit Core
          </span>
          <h2 className="text-2xl font-semibold tracking-tight text-[#1E2522] font-display mt-1">
            System Overseer Overview
          </h2>
          <p className="text-xs text-[#5C6560] mt-1 font-sans">
            Real-time compliance validation, AI-guided trace inspections, and automatic risk remediation.
          </p>
        </div>
        
        <div className="flex flex-col sm:flex-row items-stretch sm:items-start gap-3 w-full md:w-auto">
          {onToggleContinuousAudit ? (
            <div className="min-w-[260px]">
              <ContinuousAuditLockToggle
                layout="card"
                enabled={continuousAuditEnabled}
                onToggle={onToggleContinuousAudit}
                isPending={isTogglingContinuousAudit}
                pipelineActive={continuousAuditPipelineActive}
              />
            </div>
          ) : null}
          <div className={`flex items-center gap-1.5 px-3 py-1 border rounded font-mono text-[11px] self-start ${
            apiHealthy === false
              ? 'bg-rose-50 text-rose-800 border-rose-200'
              : apiHealthy === true
                ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                : 'bg-zinc-50 text-zinc-600 border-zinc-200'
          }`}>
            <Radio size={12} className={apiHealthy === true ? 'text-emerald-600 animate-pulse' : 'text-zinc-500'} />
            <span>{apiHealthy === false ? 'API offline' : apiHealthy === true ? 'Runtime online' : 'Checking runtime…'}</span>
          </div>
        </div>
      </div>

      {workspaceEmpty ? (
        <div className="rounded border border-amber-200 bg-amber-50/80 px-5 py-4 text-sm text-amber-950">
          <p className="font-display font-semibold text-[#1E2522]">Your workspace has no audit history yet</p>
          <p className="mt-1 text-xs text-[#5C6560] leading-relaxed">
            {gitLabConnected
              ? discoveredRepoCount > 0
                ? `GitLab is connected (${discoveredRepoCount} repositories discovered). Register a project in Projects Inventory, then launch a security scan.`
                : 'GitLab is connected. Open Projects Inventory to register a repository, then launch your first security scan.'
              : 'Connect GitLab under Integrations and Scope, register a project, then launch your first security scan.'}
          </p>
          {onNavigateTab ? (
            <div className="mt-3 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => onNavigateTab(gitLabConnected ? 'projects' : 'settings')}
                className="inline-flex items-center gap-1 rounded border border-amber-300 bg-white px-3 py-1.5 text-[11px] font-mono font-bold uppercase tracking-wider text-amber-900 hover:border-amber-400"
              >
                {gitLabConnected ? 'Open projects' : 'Connect GitLab'}
                <ArrowUpRight size={12} />
              </button>
              {gitLabConnected && safeProjects.length > 0 ? (
                <button
                  type="button"
                  onClick={() => onTriggerScan(safeProjects[0].id)}
                  className="inline-flex items-center gap-1 rounded border border-emerald-800 bg-emerald-950 px-3 py-1.5 text-[11px] font-mono font-bold uppercase tracking-wider text-[#72C8AF] hover:bg-emerald-900"
                >
                  Launch scan
                  <ArrowUpRight size={12} />
                </button>
              ) : null}
            </div>
          ) : null}
        </div>
      ) : null}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="bg-[#FAF8F5] border border-[#EAE6DF] rounded p-6 flex flex-col justify-between relative overflow-hidden group hover:shadow-sm transition-all">
          <div className="z-10">
            <span className="text-[10px] uppercase font-mono tracking-wider text-[#8A958F]">System Guard</span>
            <h3 className="text-md font-semibold text-[#1E2522] mt-0.5 font-display">Compliance Rating</h3>
            
            <div className="flex items-baseline gap-2 mt-4">
              <span className="text-5xl font-bold font-display tracking-tight text-[#1E2522] tabular-nums">
                {systemScore}
              </span>
              <span className="text-sm font-semibold font-mono text-[#8A958F]">/100</span>
              <span className="ml-3 text-xs font-semibold px-2 py-0.5 rounded bg-amber-500/10 text-amber-700 animate-pulse">
                {systemScore >= 85 ? 'SECURE' : 'ATTENTION REQUIRED'}
              </span>
            </div>
          </div>
          
          <div className="mt-6 pt-4 border-t border-[#EAE6DF]/60 text-xs text-[#5C6560] flex items-center justify-between font-mono z-10">
            <span>AUDITED PROJECTS: {safeProjects.length}</span>
            <div className="flex items-center gap-1 text-emerald-700">
              <TrendingUp size={12} />
              <span>{runtimeStatusLabel}</span>
            </div>
          </div>

          <div className="absolute right-[-20px] bottom-[-20px] text-[#EBE8E0]/60 -rotate-12 select-none pointer-events-none group-hover:scale-110 transition-transform">
            <ShieldCheck size={160} strokeWidth={0.8} />
          </div>
        </div>

        <div className="bg-[#FAF8F5] border border-[#EAE6DF] rounded p-6 col-span-1 lg:col-span-2 flex flex-col justify-between">
          <div>
            <span className="text-[10px] uppercase font-mono tracking-wider text-[#8A958F]">Active Vulnerabilities Ledger</span>
            <h3 className="text-md font-semibold text-[#1E2522] mt-0.5 font-display">Severity Distribution</h3>
            
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-5">
              <div className="border border-[#EAE6DF] bg-[#FDFDFD] rounded p-3 text-center relative overflow-hidden group hover:border-[#E15A5A] transition-all">
                <span className="text-[10px] font-mono text-rose-600 font-bold tracking-wider">CRITICAL</span>
                <p className="text-3xl font-bold font-display text-[#1E2522] mt-1">{stats.critical}</p>
                <div className="w-1 h-full bg-rose-600 absolute left-0 top-0" />
              </div>
              <div className="border border-[#EAE6DF] bg-[#FDFDFD] rounded p-3 text-center relative overflow-hidden group hover:border-[#E88B5D] transition-all">
                <span className="text-[10px] font-mono text-amber-600 font-bold tracking-wider">HIGH</span>
                <p className="text-3xl font-bold font-display text-[#1E2522] mt-1">{stats.high}</p>
                <div className="w-1 h-full bg-amber-500 absolute left-0 top-0" />
              </div>
              <div className="border border-[#EAE6DF] bg-[#FDFDFD] rounded p-3 text-center relative overflow-hidden group hover:border-[#8370F2] transition-all">
                <span className="text-[10px] font-mono text-indigo-500 font-bold tracking-wider">MEDIUM</span>
                <p className="text-3xl font-bold font-display text-[#1E2522] mt-1">{stats.medium}</p>
                <div className="w-1 h-full bg-indigo-500 absolute left-0 top-0" />
              </div>
              <div className="border border-[#EAE6DF] bg-[#FDFDFD] rounded p-3 text-center relative overflow-hidden group hover:border-[#7AB355] transition-all">
                <span className="text-[10px] font-mono text-emerald-600 font-bold tracking-wider">LOW</span>
                <p className="text-3xl font-bold font-display text-[#1E2522] mt-1">{stats.low}</p>
                <div className="w-1 h-full bg-emerald-500 absolute left-0 top-0" />
              </div>
            </div>
          </div>

          <div className="mt-4 pt-4 border-t border-[#EAE6DF]/60 text-xs text-[#5C6560] font-mono flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
            <span>TOTAL FINDINGS OVERALL HISTORY: {totalFindingsCount}</span>
            <span className="text-[10px] px-2 py-0.5 bg-[#FAF8F5] border border-[#EAE6DF] text-[#717A75] rounded">
              LATEST RUN: {recentAudit ? new Date(recentAudit.date).toLocaleDateString() : 'N/A'}
            </span>
          </div>
        </div>
      </div>

      {monitorAudit ? (
        <AuditRuntimeConsole
          panelTitle="Operations Runtime"
          auditId={monitorAudit.id}
          auditStatus={monitorAudit.status}
          agentRuns={
            monitorSnapshot?.agentRuns ??
            monitorAudit.agentRuns?.map((run) => ({
              agentName: run.agentName,
              status: run.status,
              startedAt: run.startedAt
            })) ??
            []
          }
          events={monitorSnapshot?.events ?? []}
          summary={monitorSnapshot?.summary}
          onStopAll={onStopAllRuntime}
          onResume={onResumeAudit}
          showStopAll={showStopAll}
          isStopAllPending={isStopAllPending}
          isResumePending={isResumePending}
        />
      ) : null}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-[#FAF8F5] border border-[#EAE6DF] rounded p-6">
            <div className="flex justify-between items-center mb-4">
              <div>
                <span className="text-[10px] uppercase font-mono tracking-wider text-[#8A958F]">Cluster Grouping</span>
                <h3 className="text-md  font-semibold text-[#1E2522] font-display">Active Risk Clusters</h3>
              </div>
              <span className="text-xs font-mono px-2 py-0.5 bg-neutral-100 border border-neutral-200 rounded text-neutral-600">
                {clustersToShow.length} clusters
              </span>
            </div>

            <div className="space-y-4">
              {!hasRealClusters ? (
                <div className="rounded border border-dashed border-[#EAE6DF] bg-[#FDFDFD] px-4 py-8 text-center">
                  <p className="text-xs font-display font-semibold uppercase tracking-wide text-[#1E2522]">
                    No clustered risks yet
                  </p>
                  <p className="mt-2 text-xs text-[#5C6560] leading-relaxed max-w-md mx-auto">
                    Run an audit to populate deduplicated risk clusters from the orchestrator.
                  </p>
                </div>
              ) : (
                visibleClusters.map((cluster) => (
                <div key={cluster.id} className="border border-[#EAE6DF] bg-[#FDFDFD] rounded p-4 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 hover:border-emerald-950/20 transition-all">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className={`w-2 h-2 rounded-full ${cluster.severity === 'CRITICAL' ? 'bg-rose-600' : 'bg-amber-500'}`} />
                      <h4 className="text-xs font-bold text-[#1E2522] font-display uppercase tracking-wide">
                        {cluster.name}
                      </h4>
                      <span className="text-[9px] font-mono bg-stone-100 border border-stone-200 px-1.5 py-0.2 rounded text-[#717A75]">
                        {cluster.severity}
                      </span>
                    </div>
                    <p className="text-xs text-[#5C6560] max-w-lg leading-relaxed">
                      {cluster.description}
                    </p>
                  </div>

                  <div className="flex items-center gap-4 shrink-0 font-mono text-[11px]">
                    <div className="text-right">
                      <span className="block text-[#8A958F] text-[9px] uppercase">PROJECTS IMPACTED</span>
                      <span className="font-semibold text-[#1E2522]">{cluster.projectIds.length} instances</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => onOpenRiskCluster?.(cluster)}
                      disabled={
                        !onOpenRiskCluster ||
                        !cluster.auditRunId ||
                        cluster.findingsCount === 0
                      }
                      className="px-3 py-1.5 bg-indigo-50 border border-indigo-200 text-indigo-800 rounded font-bold text-center min-w-[70px] hover:bg-indigo-100 hover:border-indigo-300 transition-all inline-flex items-center justify-center gap-1 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                      aria-label={`Open ${cluster.findingsCount} findings in ${cluster.name}`}
                    >
                      {cluster.findingsCount} Open
                      <ArrowUpRight size={12} />
                    </button>
                  </div>
                </div>
              ))
              )}
            </div>

            {hasRealClusters ? (
            <SeeMoreButton
              expanded={clustersExpanded}
              hiddenCount={Math.max(0, clustersToShow.length - CLUSTER_PREVIEW_COUNT)}
              onToggle={() => setClustersExpanded((prev) => !prev)}
              onNavigate={onNavigateTab ? () => onNavigateTab('audits') : undefined}
              navigateLabel={onNavigateTab ? 'Open audits' : undefined}
            />
            ) : null}
          </div>

          <div className="bg-[#FAF8F5] border border-[#EAE6DF] rounded p-6">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-md font-semibold text-[#1E2522] font-display">
                Audit Logs History
              </h3>
              <span className="text-xs font-mono text-[#717A75]">{audits.length} total</span>
            </div>
            
            <div className="overflow-x-auto">
              {isLoading ? (
                <OsTableSkeleton rows={6} />
              ) : (
              <table className="w-full text-left border-collapse font-sans">
                <thead>
                  <tr className="border-b border-[#EAE6DF]/80 font-mono text-[10px] text-[#8A958F] uppercase bg-[#FAF8F5]/50">
                    <th className="py-2.5 px-3">Date</th>
                    <th className="py-2.5 px-3">Project / Repository</th>
                    <th className="py-2.5 px-3">Ref Status</th>
                    <th className="py-2.5 px-3 text-center">Score</th>
                    <th className="py-2.5 px-3 text-center">Open Risks</th>
                    <th className="py-2.5 px-3 text-right">Inspect</th>
                  </tr>
                </thead>
                <tbody className="text-xs divide-y divide-[#EAE6DF]/60">
                  {visibleAudits.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-8 px-3 text-center text-[#5C6560]">
                        No audit runs yet. Register a project and launch a security scan to populate this table.
                      </td>
                    </tr>
                  ) : (
                  visibleAudits.map((audit) => {
                    const totalRisks = (audit.criticalCount || 0) + (audit.highCount || 0) + (audit.mediumCount || 0) + (audit.lowCount || 0);
                    return (
                      <tr key={audit.id} className="hover:bg-[#FCECF3]/10 transition-all">
                        <td className="py-3 px-3 font-mono text-[11px] text-[#717A75]">
                          {new Date(audit.date).toLocaleDateString()}
                        </td>
                        <td className="py-3 px-3 font-semibold text-[#1E2522] font-display">
                          {audit.projectName}
                        </td>
                        <td className="py-3 px-3">
                          <span className={`inline-flex items-center gap-1 text-[10px] font-mono px-2 py-0.5 rounded border ${
                            audit.score >= 85 
                              ? 'bg-emerald-50 border-emerald-200 text-emerald-800' 
                              : audit.score >= 60 
                                ? 'bg-amber-50 border-amber-200 text-amber-800'
                                : 'bg-rose-50 border-rose-200 text-rose-800'
                          }`}>
                            <span className={`w-1.5 h-1.5 rounded-full ${
                              audit.score >= 85 ? 'bg-emerald-600' : audit.score >= 60 ? 'bg-amber-500' : 'bg-rose-600'
                            }`} />
                            {audit.score >= 85 ? 'SECURE' : 'ATTENTION REQUIRED'}
                          </span>
                        </td>
                        <td className="py-3 px-3 text-center font-mono font-bold tabular-nums">
                          {audit.score}
                        </td>
                        <td className="py-3 px-3 text-center font-mono font-bold text-rose-600 text-sm tabular-nums">
                          {totalRisks}
                        </td>
                        <td className="py-3 px-3 text-right">
                          <button 
                            onClick={() => onSelectAudit(audit.id)}
                            className="p-1 px-2 border border-[#EAE6DF] hover:border-emerald-950 text-[10px] rounded hover:bg-[#FAF8F5] transition-all inline-flex items-center gap-1 font-semibold text-[#1E2522]"
                          >
                            <span>Inspect</span>
                            <ArrowUpRight size={12} />
                          </button>
                        </td>
                      </tr>
                    );
                  })
                  )}
                </tbody>
              </table>
              )}
            </div>

            <SeeMoreButton
              expanded={false}
              hiddenCount={Math.max(0, audits.length - AUDIT_PREVIEW_COUNT)}
              onNavigate={onNavigateTab ? () => onNavigateTab('history') : undefined}
              navigateLabel={audits.length > AUDIT_PREVIEW_COUNT && onNavigateTab ? 'See full history' : undefined}
            />
          </div>
        </div>

        <div className="space-y-6">
          <div className="bg-emerald-950 text-[#FAF8F5] rounded p-6 shadow-sm relative overflow-hidden flex flex-col justify-between min-h-[400px]">
            <div className="z-10 space-y-4">
              <div className="inline-flex py-1 px-2.5 bg-emerald-900 border border-emerald-800 rounded text-[9px] font-mono font-bold uppercase tracking-widest text-[#72C8AF]">
                OPERATIONS RUNTIME
              </div>
              
              <h3 className="text-xl font-bold tracking-tight font-display text-white">
                Launch Security Scan
              </h3>
              
              <p className="text-xs text-[#B2C5BD] leading-relaxed">
                Start a repository audit through the Premortem orchestrator. Results land in History and Issues once the run completes.
              </p>

              <div className="space-y-3 pt-2">
                <label className="block text-[10px] font-mono tracking-wider text-[#72C8AF] uppercase">
                  Select Scope Repository:
                </label>
                <div className="space-y-2">
                  {visibleProjects.length === 0 ? (
                    <button
                      type="button"
                      onClick={() => onNavigateTab?.('projects')}
                      className="w-full text-left p-3 rounded bg-emerald-900/50 border border-dashed border-emerald-700/80 hover:border-[#72C8AF]/40 hover:bg-emerald-900 transition-all text-xs text-[#B2C5BD]"
                    >
                      <span className="block font-bold text-white font-display">No projects registered</span>
                      <span className="text-[10px] font-mono mt-1 block">Open Projects Inventory to register a repository</span>
                    </button>
                  ) : (
                  visibleProjects.map((proj) => (
                    <button
                      key={proj.id}
                      onClick={() => onTriggerScan(proj.id)}
                      disabled={proj.status === 'SCANNING'}
                      className="w-full text-left p-3 rounded bg-emerald-900/50 border border-emerald-800/80 hover:border-[#72C8AF]/40 hover:bg-emerald-900 transition-all flex justify-between items-center group text-xs text-[#FAF8F5] disabled:opacity-50"
                    >
                      <div>
                        <span className="block font-bold truncate tracking-wide text-white font-display group-hover:text-[#72C8AF]">
                          {proj.name}
                        </span>
                        <span className="text-[10px] text-[#A6BCB4] font-mono">{proj.branch} branch | {proj.provider}</span>
                      </div>
                      <span className="p-1 px-2 bg-emerald-950 border border-emerald-800 rounded group-hover:border-[#72C8AF]/40 group-hover:text-[#72C8AF] text-[10px] font-mono font-bold transition-all">
                        {proj.status === 'SCANNING' ? 'SCANNING...' : 'SCAN'}
                      </span>
                    </button>
                  ))
                  )}
                </div>

                <SeeMoreButton
                  expanded={projectsExpanded}
                  hiddenCount={Math.max(0, safeProjects.length - PROJECT_PREVIEW_COUNT)}
                  onToggle={() => setProjectsExpanded((prev) => !prev)}
                  onNavigate={onNavigateTab ? () => onNavigateTab('projects') : undefined}
                  navigateLabel={onNavigateTab ? 'All projects' : undefined}
                  tone="dark"
                />
              </div>
            </div>

            <div className="z-10 border-t border-emerald-900 pt-4 mt-6 flex justify-between items-center text-[10px] font-mono text-[#A6BCB4]">
              <span>PREMORTEM INTELLIGENCE</span>
              <span className="text-white">{premortemBrand.engineVersion}</span>
            </div>
            
            <div className="absolute right-[-40px] bottom-[-40px] text-emerald-900/40 pointer-events-none noselect select-none rotate-12">
              <ShieldAlert size={280} strokeWidth={0.5} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
