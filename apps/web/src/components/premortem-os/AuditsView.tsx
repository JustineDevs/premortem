import React, { useState } from 'react';
import { premortemBrand } from '@/lib/premortem-os/branding';
import { AuditRun, Finding, TraceStep, SeverityType, ConsoleReviewActionValue, RiskCluster } from '@/lib/premortem-os/types';
import { mapSnapshotToAuditRun } from '@/lib/premortem-api/map-runtime-to-console';
import { ConsoleReviewAction, ConsoleIssueStatus } from '@premortem/domain';
import { AuditsInvestigationsPanel } from './audits-investigations-panel';
import { AuditRuntimeConsole } from './audit-runtime-console';
import { FindingSourceEvidence } from './finding-source-evidence';
import { SwarmDualLanePanel } from './swarm-dual-lane-panel';
import { OsTabs } from './os-tabs';
import { OsToast } from './os-toast';
import {
  buildSwarmTimelineActions,
  classifySwarmLane,
  splitAgentsIntoLanes,
  type SwarmLaneAgent
} from '@/lib/premortem-os/swarm-lanes';
import { ProviderIcon } from './ProviderIcon';
import { isPublishedIssueUrl } from '@/lib/premortem-os/publish-links';
import { 
  ShieldAlert, 
  ChevronRight, 
  GitBranch, 
  RotateCw, 
  HelpCircle,
  CornerDownRight,
  TrendingDown,
  ArrowRight,
  Sparkles,
  Check,
  AlertTriangle,
  FolderLock,
  Wrench,
  ThumbsUp,
  Ban,
  Terminal,
  Save,
  GitMerge,
  ExternalLink,
  ShieldCheck,
  FileText,
  Activity,
  Layers,
  CheckSquare,
  Sparkle
} from 'lucide-react';
import { parseAuditCheckpoint } from '@premortem/domain';

interface AuditsViewProps {
  audits: AuditRun[];
  selectedAuditId: string | null;
  focusCluster?: RiskCluster | null;
  onFocusClusterComplete?: () => void;
  onSelectAudit: (auditId: string) => void;
  onUpdateFindingStatus: (auditId: string, issueId: string, action: ConsoleReviewActionValue) => void;
  onUpdateFindingFields: (auditId: string, findingId: string, fields: Partial<Finding>) => void;
  onPersistFindingFields: (auditId: string, findingId: string, fields: Partial<Finding>) => Promise<void>;
  onAuditHydrated: (auditId: string, audit: AuditRun) => void;
  onDeployPatch: (auditId: string, issueId: string) => void;
  isPatching: boolean;
  onTriggerScan: (projectId: string) => void;
  onStopAllRuntime?: () => void | Promise<void>;
  onResumeAudit?: (auditId: string) => void | Promise<void>;
  showStopAll?: boolean;
  isStopAllPending?: boolean;
  isResumePending?: boolean;
}

export function AuditsView({
  audits,
  selectedAuditId,
  focusCluster = null,
  onFocusClusterComplete,
  onSelectAudit,
  onUpdateFindingStatus,
  onUpdateFindingFields,
  onPersistFindingFields,
  onAuditHydrated,
  onDeployPatch,
  isPatching,
  onTriggerScan,
  onStopAllRuntime,
  onResumeAudit,
  showStopAll = false,
  isStopAllPending = false,
  isResumePending = false
}: AuditsViewProps) {
  const [activeTab, setActiveTab] = useState<'summary' | 'findings' | 'swarm'>('findings');
  const [selectedFindingId, setSelectedFindingId] = useState<string | null>(null);
  const [severityFilter, setSeverityFilter] = useState<'ALL' | SeverityType>('ALL');

  // GitLab Issue synthesis mode variables
  const [workspaceMode, setWorkspaceMode] = useState<'inspect' | 'synthesis'>('inspect');
  const [isSyncingToGitLab, setIsSyncingToGitLab] = useState(false);
  const [isSavingSynthesis, setIsSavingSynthesis] = useState(false);
  const [mergeTargetId, setMergeTargetId] = useState<string>('');
  const [splitTitle, setSplitTitle] = useState('');
  const [isSplitting, setIsSplitting] = useState(false);
  const [activeAgentId, setActiveAgentId] = useState<string>('');
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [toastTone, setToastTone] = useState<'success' | 'error'>('success');
  const [runtimeSnapshot, setRuntimeSnapshot] = useState<{
    agentRuns: Array<{ id: string; agentName: string; status: string; startedAt?: string | null; completedAt?: string | null }>;
    lineage: Array<{ stage: string; id: string; label: string; parentId?: string }>;
    graphSnapshot?: { nodeCount: number; edgeCount: number } | null;
    events: Array<{ eventType: string; actor: string; createdAt: string }>;
    findings: Array<{ id: string; title: string; category: string; severity: string; agentRunId: string }>;
    summary?: unknown;
  } | null>(null);

  const selectedAudit = audits.find((a) => a.id === selectedAuditId) || audits[0];
  const runtimeCheckpoint = parseAuditCheckpoint(runtimeSnapshot?.summary);

  const showToast = (message: string, tone: 'success' | 'error' = 'success') => {
    setToastMessage(message);
    setToastTone(tone);
    setTimeout(() => setToastMessage(null), 3050);
  };

  const alert = (message: string) => showToast(message, 'error');

  const setSeverityFilterFromValue = (value: string) => {
    if (value === 'ALL') {
      setSeverityFilter('ALL');
      return;
    }

    if (value === 'CRITICAL' || value === 'HIGH' || value === 'MEDIUM' || value === 'LOW') {
      setSeverityFilter(value.toLowerCase() as SeverityType);
    }
  };

  React.useEffect(() => {
    if (!selectedAudit?.id) {
      setRuntimeSnapshot(null);
      return;
    }

    let cancelled = false;
    let inFlight = false;
    let currentController: AbortController | null = null;

    const loadSnapshot = async (hydrate: boolean) => {
      if (cancelled || inFlight) return;
      inFlight = true;
      const controller = new AbortController();
      currentController = controller;
      try {
        const response = await fetch(
          `/api/audits/${selectedAudit.id}${hydrate ? '?hydrate=1' : '?hydrate=0'}`,
          { signal: controller.signal }
        );
        const payload = await response.json();
        const snapshot = payload.snapshot ?? payload.auditRun;
        if (cancelled || !snapshot) return;
        setRuntimeSnapshot(snapshot);
        if (snapshot.agentRuns?.[0]?.id && !activeAgentId) {
          setActiveAgentId(snapshot.agentRuns[0].id);
        }

        const hydrated = mapSnapshotToAuditRun(snapshot, selectedAudit.projectName);
        onAuditHydrated(selectedAudit.id, hydrated);
      } catch {
        if (!cancelled) setRuntimeSnapshot(null);
      } finally {
        inFlight = false;
        if (currentController === controller) {
          currentController = null;
        }
      }
    };

    void loadSnapshot(true);

    const shouldPoll =
      selectedAudit.status === 'RUNNING' ||
      selectedAudit.status === 'PAUSED' ||
      activeTab === 'swarm';
    if (!shouldPoll)
      return () => {
        cancelled = true;
        currentController?.abort();
      };

    const timer = window.setInterval(() => {
      void loadSnapshot(false);
    }, 2000);
    return () => {
      cancelled = true;
      currentController?.abort();
      window.clearInterval(timer);
    };
  }, [selectedAudit?.id, selectedAudit?.projectName, selectedAudit?.status, activeTab, onAuditHydrated]);

  React.useEffect(() => {
    if (selectedAudit && selectedAudit.findings?.length > 0) {
      // Find first finding that is not merged or split
      const nonMerged = selectedAudit.findings.find(f => !f.mergedIntoId);
      setSelectedFindingId(nonMerged ? nonMerged.id : selectedAudit.findings[0].id);
    } else {
      setSelectedFindingId(null);
    }
  }, [selectedAuditId, selectedAudit]);

  React.useEffect(() => {
    if (!focusCluster || focusCluster.auditRunId !== selectedAudit?.id) return;

    const findings = selectedAudit.findings ?? [];
    if (findings.length === 0) return;

    setActiveTab('findings');
    setSeverityFilter(focusCluster.severity);

    const clusterIssueIds = new Set(
      (selectedAudit.lineage ?? [])
        .filter((entry) => entry.stage === 'issue_candidate' && entry.parentId === focusCluster.id)
        .map((entry) => entry.id)
    );

    const clusterFinding =
      findings.find((finding) => clusterIssueIds.has(finding.id) && !finding.mergedIntoId) ??
      findings.find((finding) => finding.severity === focusCluster.severity && !finding.mergedIntoId);

    if (clusterFinding) {
      setSelectedFindingId(clusterFinding.id);
    }

    onFocusClusterComplete?.();
  }, [
    focusCluster,
    selectedAudit?.id,
    selectedAudit?.findings,
    selectedAudit?.lineage,
    onFocusClusterComplete
  ]);

  if (!selectedAudit) {
    return (
      <div className="flex-1 p-8 text-center text-xs text-[#5C6560] italic">
        Loading cybersecurity continuous audit logs...
      </div>
    );
  }

  const findings = selectedAudit.findings || [];
  
  // Exclude findings that have been merged into others to support a clean list
  const visibleFindings = findings.filter(f => !f.mergedIntoId);

  const filteredFindings = visibleFindings.filter(f => {
    return severityFilter === 'ALL' || f.severity === severityFilter;
  });

  const activeFinding = findings.find(f => f.id === selectedFindingId) || filteredFindings[0] || findings[0];

  const synthesisField = (value: string | undefined, emptyLabel: string) => value?.trim() ? value : '';

  const getSeverityStyles = (severity: SeverityType) => {
    switch (severity) {
      case 'CRITICAL':
        return { text: 'text-rose-600', bg: 'bg-rose-50 border-rose-200', dot: 'bg-rose-600' };
      case 'HIGH':
        return { text: 'text-amber-600', bg: 'bg-amber-50 border-amber-200', dot: 'bg-amber-500' };
      case 'MEDIUM':
        return { text: 'text-indigo-600', bg: 'bg-indigo-50 border-indigo-200', dot: 'bg-indigo-500' };
      case 'LOW':
        return { text: 'text-emerald-600', bg: 'bg-emerald-50 border-emerald-200', dot: 'bg-emerald-500' };
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'OPEN':
        return 'bg-zinc-100 text-zinc-700 border border-zinc-200';
      case 'CONFIRMED':
        return 'bg-amber-50 text-amber-700 border border-amber-200 uppercase font-bold';
      case 'DISMISSED':
        return 'bg-stone-100 text-stone-500 border border-stone-200 line-through';
      case 'RESOLVED':
        return 'bg-emerald-50 text-emerald-800 border border-emerald-200 font-bold';
      case 'PUBLISHED':
        return 'bg-orange-50 text-orange-800 border border-orange-200 font-bold uppercase';
      default:
        return 'bg-zinc-100 text-zinc-700';
    }
  };

  // 1. Live Synthesis fields updates on parent state
  const handleFieldChange = (fieldName: string, val: string) => {
    if (!activeFinding) return;
    onUpdateFindingFields(selectedAudit.id, activeFinding.id, { [fieldName]: val });
  };

  const handleSaveSynthesis = async () => {
    if (!activeFinding) return;
    setIsSavingSynthesis(true);
    try {
      await onPersistFindingFields(selectedAudit.id, activeFinding.id, {
        title: activeFinding.title,
        description: activeFinding.description,
        whyItMatters: activeFinding.whyItMatters ?? '',
        recommendation: activeFinding.recommendation
      });
    } catch (error) {
      alert(error instanceof Error ? error.message : 'Failed to save synthesis fields.');
    } finally {
      setIsSavingSynthesis(false);
    }
  };

  // GitLab publish via runtime API (approve first, then publish)
  const handlePushToGitLab = async () => {
    if (!activeFinding || !selectedAudit) return;
    setIsSyncingToGitLab(true);
    try {
      await onPersistFindingFields(selectedAudit.id, activeFinding.id, {
        title: activeFinding.title,
        description: activeFinding.description,
        whyItMatters: activeFinding.whyItMatters ?? '',
        recommendation: activeFinding.recommendation
      });

      if (
        activeFinding.status !== ConsoleIssueStatus.CONFIRMED &&
        activeFinding.status !== ConsoleIssueStatus.RESOLVED &&
        activeFinding.status !== ConsoleIssueStatus.PUBLISHED
      ) {
        const approveResponse = await fetch(
          `/api/audits/${selectedAudit.id}/issues/${activeFinding.id}/action`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: ConsoleReviewAction.CONFIRM })
          }
        );
        if (!approveResponse.ok) {
          const errPayload = await approveResponse.json().catch(() => ({}));
          throw new Error(
            typeof errPayload.error === 'string' ? errPayload.error : 'Failed to approve finding.'
          );
        }
        onUpdateFindingStatus(selectedAudit.id, activeFinding.id, ConsoleReviewAction.CONFIRM);
      }

      const publishResponse = await fetch(`/api/issues/${activeFinding.id}/publish`, { method: 'POST' });
      if (!publishResponse.ok) {
        const errPayload = await publishResponse.json().catch(() => ({}));
        const message =
          typeof errPayload.error === 'string'
            ? errPayload.error
            : `Publish failed (${publishResponse.status})`;
        if (errPayload.code === 'feature_locked') {
          throw new Error(`${message} Upgrade to Starter in Settings → Billing to publish to GitLab.`);
        }
        if (errPayload.code === 'publish_not_approved') {
          throw new Error(message);
        }
        throw new Error(message);
      }

      const publishResult = await publishResponse.json() as {
        dryRun?: boolean;
        publishedIssue?: { id?: string; url?: string | null };
        error?: string;
        code?: string;
      };

      if (publishResult.dryRun) {
        alert(
          'Publish dry-run only: no GitLab issue was created. Remove PREMORTEM_PUBLISH_DRY_RUN from .env.local and restart dev to create real GitLab issues.'
        );
        return;
      }

      const publishedUrlFromApi = publishResult.publishedIssue?.url ?? null;
      if (publishedUrlFromApi && isPublishedIssueUrl(publishedUrlFromApi)) {
        onUpdateFindingFields(selectedAudit.id, activeFinding.id, {
          gitlabIssueId: publishedUrlFromApi,
          status: ConsoleIssueStatus.PUBLISHED
        });
        return;
      }

      const publishRes = await fetch(`/api/audits/${selectedAudit.id}`);
      if (!publishRes.ok) {
        throw new Error(`Publish succeeded but audit refresh failed (${publishRes.status}). Check GitLab for the new issue.`);
      }
      const publishPayload = await publishRes.json();
      const published = publishPayload.snapshot?.issueCandidates?.find(
        (issue: { id: string }) => issue.id === activeFinding.id
      );
      const publishedUrl = published?.publishedUrl ?? publishedUrlFromApi;
      if (isPublishedIssueUrl(publishedUrl)) {
        onUpdateFindingFields(selectedAudit.id, activeFinding.id, {
          gitlabIssueId: publishedUrl,
          status: ConsoleIssueStatus.PUBLISHED
        });
      } else {
        throw new Error(
          publishResult.publishedIssue?.id
            ? 'Issue publish completed but no GitLab URL was returned. Verify GitLab connection and project publish access.'
            : 'Publish did not return a GitLab issue URL.'
        );
      }
    } catch (error) {
      alert(error instanceof Error ? error.message : 'Failed to publish to GitLab.');
    } finally {
      setIsSyncingToGitLab(false);
    }
  };

  // Merge duplicate findings via persisted review API
  const handleMergeFindings = async () => {
    if (!activeFinding || !mergeTargetId) return;
    const target = findings.find(f => f.id === mergeTargetId);
    if (!target) return;

    const mergeResponse = await fetch(`/api/issues/${mergeTargetId}/merge`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mergedIntoIssueCandidateId: activeFinding.id })
    });
    if (!mergeResponse.ok) {
      alert('Failed to merge findings.');
      return;
    }

    onUpdateFindingFields(selectedAudit.id, mergeTargetId, {
      mergedIntoId: activeFinding.id,
      status: ConsoleIssueStatus.DISMISSED
    });

    const updatedDesc = `${activeFinding.description}\n\n[DEDUPLICATED] Merged "${target.title}" from ${target.filepath}:${target.line}.`;
    await onPersistFindingFields(selectedAudit.id, activeFinding.id, {
      description: updatedDesc
    });

    setMergeTargetId('');
  };

  const handleSplitFinding = async () => {
    if (!activeFinding) return;

    const title = splitTitle.trim() || `${activeFinding.title} (Follow-up)`;
    setIsSplitting(true);
    try {
      const splitResponse = await fetch(`/api/issues/${activeFinding.id}/split`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title,
          notes: 'Split from reviewer console'
        })
      });
      if (!splitResponse.ok) {
        const errPayload = await splitResponse.json().catch(() => ({}));
        throw new Error(errPayload.error || 'Split failed');
      }

      const auditResponse = await fetch(`/api/audits/${selectedAudit.id}`);
      if (auditResponse.ok) {
        const auditPayload = await auditResponse.json();
        if (auditPayload.snapshot) {
          onAuditHydrated(
            selectedAudit.id,
            mapSnapshotToAuditRun(auditPayload.snapshot, selectedAudit.projectName)
          );
        }
      }

      onUpdateFindingFields(selectedAudit.id, activeFinding.id, {
        isSplitted: true
      });
      setSplitTitle('');
    } catch (error) {
      alert(error instanceof Error ? error.message : 'Failed to split finding.');
    } finally {
      setIsSplitting(false);
    }
  };

  const runtimeAgentRuns = runtimeSnapshot?.agentRuns ?? selectedAudit.agentRuns ?? [];
  const snapshotFindings = runtimeSnapshot?.findings ?? [];
  const swarmAgents: SwarmLaneAgent[] = runtimeAgentRuns.map((run) => {
    const agentFindings = snapshotFindings.filter((finding) => finding.agentRunId === run.id);
    const lineageLabels = (runtimeSnapshot?.lineage ?? selectedAudit.lineage ?? [])
      .filter((entry) => entry.parentId === run.id || entry.id === run.id)
      .map((entry) => entry.label);
    return {
      id: run.id,
      name: run.agentName,
      lens: run.agentName.replace(/-/g, ' '),
      status: run.status === 'completed' ? 'COMPLETED' : run.status === 'failed' ? 'FAILED' : 'ACTIVE',
      boundedFiles: lineageLabels.slice(0, 4),
      memoryState: `${agentFindings.length} findings · ${run.status}`,
      findingsCount: agentFindings.length,
      lane: classifySwarmLane(run.agentName),
      logs: [
        run.startedAt ? `Started ${new Date(run.startedAt).toLocaleString()}` : null,
        ...agentFindings.slice(0, 6).map((finding) => `[${finding.severity}] ${finding.title}`),
        run.completedAt
          ? `Completed ${new Date(run.completedAt).toLocaleString()}`
          : `Current status: ${run.status}`
      ].filter(Boolean) as string[]
    };
  });

  const { repository: repositoryAgents, runtime: runtimeAgents } = splitAgentsIntoLanes(swarmAgents);
  const swarmTimeline = buildSwarmTimelineActions({
    events: runtimeSnapshot?.events ?? [],
    findings: snapshotFindings,
    agentRuns: runtimeAgentRuns
  });

  const selectedAgent = swarmAgents.find((a) => a.id === activeAgentId) || swarmAgents[0];
  const graphNodeCount =
    runtimeSnapshot?.graphSnapshot?.nodeCount ?? selectedAudit.graphSnapshot?.nodeCount ?? 0;
  const lineageEntries = runtimeSnapshot?.lineage ?? selectedAudit.lineage ?? [];

  return (
    <div className="flex-1 flex overflow-hidden font-sans h-screen" id="audits-view-panel">
      <AuditsInvestigationsPanel
        audits={audits}
        selectedAuditId={selectedAudit.id}
        onSelectAudit={onSelectAudit}
      />

      {/* Main workspace context */}
      <div className="flex-1 flex flex-col h-full overflow-hidden bg-white">
        {/* Header segment with Sub-tab controls */}
        <div className="p-6 border-b border-[#EAE6DF] bg-[#FAF8F5]/30 shrink-0">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] uppercase tracking-wider font-mono bg-neutral-100 px-1.5 py-0.5 rounded text-neutral-600 border border-neutral-200">
                  REF: {selectedAudit.id.toUpperCase()}
                </span>
                <span className="text-[11px] font-mono text-[#717A75]">
                  Audited on {new Date(selectedAudit.date).toLocaleString()}
                </span>
              </div>
              <h2 className="text-xl font-bold tracking-tight text-[#1E2522] font-display mt-2">
                {selectedAudit.projectName} Continuous Security Audit
              </h2>
            </div>

            {/* Compliance Index Circular Gauge */}
            <div className="flex items-center gap-4 bg-[#F2EFF6]/60 p-3 rounded border border-[#EAE6DF] shrink-0 font-mono text-xs">
              <div>
                <span className="block text-[8px] uppercase tracking-widest text-neutral-500">COMPLIANCE INDEX</span>
                <span className="text-xl font-bold font-display text-zinc-900">{selectedAudit.score}%</span>
              </div>
              <div className="w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm bg-emerald-950 text-white shadow-inner">
                {selectedAudit.score}
              </div>
            </div>
          </div>

          {/* Sub-tabs switch */}
          <OsTabs
            className="mt-6"
            activeId={activeTab}
            onChange={(id) => setActiveTab(id as typeof activeTab)}
            ariaLabel="Audit workspace sections"
            tabs={[
              { id: 'summary', label: 'Compliance Summary', icon: FileText },
              { id: 'findings', label: 'Trace Investigations', icon: ShieldAlert },
              { id: 'swarm', label: 'Swarm Orchestration Plan', icon: Layers }
            ]}
          />
        </div>

        {/* Tab content renders */}
        <div className="flex-1 overflow-hidden">
          
          {/* TAB 1: SUMMARY */}
          {activeTab === 'summary' && (
            <div className="p-6 overflow-y-auto h-full space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                <div className="p-4 bg-zinc-50 border border-zinc-200 rounded text-xs space-y-1">
                  <h4 className="font-bold text-[#1E2522]">Compliance summary</h4>
                  <p className="text-[#5C6560]">
                    Structured from the persisted audit checkpoint, runtime counts, and trace lineage.
                  </p>
                </div>
                <div className="p-4 bg-white border border-[#EAE6DF] rounded text-xs space-y-1">
                  <span className="block text-[10px] font-mono uppercase tracking-wider text-[#8A958F]">Phase</span>
                  <p className="font-semibold text-[#1E2522]">
                    {runtimeCheckpoint?.phase?.replace(/_/g, ' ') ?? selectedAudit.status}
                  </p>
                </div>
                <div className="p-4 bg-white border border-[#EAE6DF] rounded text-xs space-y-1">
                  <span className="block text-[10px] font-mono uppercase tracking-wider text-[#8A958F]">Completed specialists</span>
                  <p className="font-semibold text-[#1E2522]">
                    {runtimeCheckpoint?.completedSpecialists.length ?? runtimeAgentRuns.length}
                  </p>
                </div>
                <div className="p-4 bg-white border border-[#EAE6DF] rounded text-xs space-y-1">
                  <span className="block text-[10px] font-mono uppercase tracking-wider text-[#8A958F]">Checkpoint saved</span>
                  <p className="font-semibold text-[#1E2522]">
                    {runtimeCheckpoint?.savedAt ? new Date(runtimeCheckpoint.savedAt).toLocaleString() : new Date(selectedAudit.date).toLocaleString()}
                  </p>
                </div>
              </div>

              <div className="border border-[#EAE6DF] rounded overflow-hidden">
                <table className="w-full text-left text-xs border-collapse font-sans">
                  <thead>
                    <tr className="border-b border-[#EAE6DF] bg-[#FAF8F5] font-mono text-[10px] text-[#8A958F] uppercase">
                      <th className="p-3">Severity</th>
                      <th className="p-3">Target File</th>
                      <th className="p-3">Line</th>
                      <th className="p-3">Risk Title</th>
                      <th className="p-3">Status Badging</th>
                      <th className="p-3 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#EAE6DF]/60">
                    {findings.map((f) => {
                      const sevStyles = getSeverityStyles(f.severity);
                      return (
                        <tr key={f.id} className={`hover:bg-neutral-50 transition-all font-sans ${f.mergedIntoId ? 'opacity-50 line-through bg-neutral-100/50' : ''}`}>
                          {/* Severity */}
                          <td className="p-3">
                            <span className={`inline-flex items-center gap-1.5 text-[10px] font-mono font-bold px-2 py-0.5 border rounded-sm ${sevStyles?.bg} ${sevStyles?.text}`}>
                              <span className={`w-1.5 h-1.5 rounded-full ${sevStyles?.dot}`} />
                              {f.severity}
                            </span>
                          </td>

                          {/* File path */}
                          <td className="p-3 font-mono text-[11px] font-semibold text-[#1E2522]">
                            {f.filepath}
                          </td>

                          {/* Line */}
                          <td className="p-3 font-mono text-neutral-500">
                            :{f.line}
                          </td>

                          {/* Title */}
                          <td className="p-3 font-semibold text-neutral-800">
                            <span className="flex items-center gap-1.5">
                              {f.title}
                              {f.mergedIntoId && <span className="text-[9px] font-mono font-bold uppercase bg-stone-200 text-stone-600 px-1 py-0.2 rounded">Merged</span>}
                            </span>
                          </td>

                          {/* Status */}
                          <td className="p-3 text-[10px]">
                            <span className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold ${getStatusBadge(f.status)}`}>
                              {f.status}
                            </span>
                          </td>

                          {/* Hotkey Inspect */}
                          <td className="p-3 text-right">
                            <button
                              onClick={() => {
                                setSelectedFindingId(f.id);
                                setActiveTab('findings');
                              }}
                              className="px-2 py-1 bg-white border border-[#EAE6DF] text-[10px] font-semibold rounded hover:bg-[#FAF8F5] hover:border-emerald-950 transition-all cursor-pointer inline-flex items-center gap-0.5"
                            >
                              <span>Inspect</span>
                              <ChevronRight size={10} />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB 2: FINDINGS & ACTIONABLE ISSUES */}
          {activeTab === 'findings' && (
            <div className="flex h-full overflow-hidden">
              {/* Left Column - Findings checkboxes check lists */}
              <div className="w-80 border-r border-[#EAE6DF] overflow-y-auto shrink-0 divide-y divide-[#EAE6DF]/40 bg-[#FAF8F5]/20 h-full">
                <div className="p-3 bg-[#FAF8F5] border-b border-[#EAE6DF] flex items-center justify-between text-[10px] font-mono shrink-0">
                  <span className="text-[#8A958F] font-bold uppercase">FILTER SEVERITY</span>
                  <select
                    value={severityFilter}
                    onChange={(e) => setSeverityFilterFromValue(e.target.value)}
                    className="p-1 px-1.5 border border-[#EAE6DF] bg-white rounded focus:outline-none focus:border-emerald-950 font-bold uppercase text-[9px] text-[#1E2522]"
                  >
                    <option value="ALL">ALL RISK SIZES</option>
                    <option value="CRITICAL">CRITICAL ONLY</option>
                    <option value="HIGH">HIGH ONLY</option>
                    <option value="MEDIUM">MEDIUM ONLY</option>
                    <option value="LOW">LOW ONLY</option>
                  </select>
                </div>

                {filteredFindings.length === 0 ? (
                  <div className="p-8 text-center text-xs text-[#5C6560] italic">
                    No findings match current severity limits.
                  </div>
                ) : (
                  filteredFindings.map((f) => {
                    const sev = getSeverityStyles(f.severity);
                    const isSel = f.id === activeFinding?.id;
                    return (
                      <button
                        key={f.id}
                        onClick={() => setSelectedFindingId(f.id)}
                        className={`w-full text-left p-4 cursor-pointer text-xs transition-all ${
                          isSel
                            ? 'bg-[#F2EFF6]/60 border-l-4 border-l-emerald-950 border-b border-[#EAE6DF]'
                            : 'hover:bg-neutral-50 border-b border-[#EAE6DF]/40'
                        }`}
                      >
                        <div className="flex justify-between items-baseline gap-1">
                          <span className={`text-[10px] font-bold font-mono ${sev?.text}`}>
                            {f.severity}
                          </span>
                          <span className="text-[10px] font-mono text-[#8A958F] truncate">
                            {f.filepath}:{f.line}
                          </span>
                        </div>
                        <h4 className="font-semibold text-neutral-800 text-xs mt-1.5 font-display block leading-snug">
                          {f.title}
                        </h4>
                        <div className="flex items-center justify-between mt-3 text-[9px] font-mono">
                          <span className="text-[#8A958F] truncate">{f.category}</span>
                          <div className="flex items-center gap-1.5">
                            {isPublishedIssueUrl(f.gitlabIssueId) ? (
                              <span className="px-1 py-0.2 bg-orange-100 text-orange-700 font-bold rounded text-[8px] uppercase">
                                Sync
                              </span>
                            ) : null}
                            <span className={`px-1.5 rounded text-[8.5px] ${getStatusBadge(f.status)}`}>
                              {f.status}
                            </span>
                          </div>
                        </div>
                      </button>
                    );
                  })
                )}
              </div>

              {/* Right Column - workspace container */}
              {activeFinding ? (
                <div className="min-w-0 flex-1 overflow-y-auto overflow-x-hidden p-6 space-y-6 bg-white h-full relative">
                  
                  {/* Mode Toggler Pill */}
                  <div className="flex justify-between items-center border-b border-zinc-100 pb-3 gap-4 shrink-0">
                    <div className="flex items-center gap-1.5 p-1 bg-zinc-100/80 rounded-lg w-fit text-xs border border-zinc-200">
                      <button
                        type="button"
                        onClick={() => setWorkspaceMode('inspect')}
                        className={`py-1.5 px-3 rounded-md font-semibold transition-all cursor-pointer text-[11px] ${
                          workspaceMode === 'inspect'
                            ? 'bg-white text-emerald-950 shadow-sm font-bold'
                            : 'text-zinc-500 hover:text-zinc-800'
                        }`}
                      >
                        Security Trace Inspection
                      </button>
                      <button
                        type="button"
                        onClick={() => setWorkspaceMode('synthesis')}
                        className={`py-1.5 px-3 rounded-md font-semibold transition-all cursor-pointer flex items-center gap-1.5 text-[11px] ${
                          workspaceMode === 'synthesis'
                            ? 'bg-emerald-950 text-white shadow-sm font-bold'
                            : 'text-zinc-500 hover:text-zinc-800'
                        }`}
                      >
                        <ProviderIcon 
                          slug="gitlab"
                          className="w-3.5 h-3.5 inline"
                        />
                        <span>GitLab Issue Synthesis Desk</span>
                      </button>
                    </div>

                    <div className="text-[10px] uppercase font-mono tracking-wider bg-orange-50 border border-orange-200/60 text-orange-700 px-2 py-0.5 rounded flex items-center gap-1.5">
                      <ProviderIcon 
                        slug="gitlab"
                        className="w-3.5 h-3.5 inline animate-pulse"
                      />
                      <span>GitLab Sync Ready</span>
                    </div>
                  </div>

                  {/* MODE A: TRACE INSPECTION DEFAULT */}
                  {workspaceMode === 'inspect' && (
                    <div className="space-y-6">
                      {/* Technical details block */}
                      <div className="p-5 border border-[#EAE6DF] bg-[#FAF8F5] rounded space-y-3 relative overflow-hidden">
                        <div className="flex justify-between items-start gap-1 z-10 relative">
                          <div className="space-y-1">
                            <div className="flex items-center gap-1.5">
                              <span className={`text-[9px] font-bold font-mono px-1.5 py-0.2 rounded border uppercase ${
                                getSeverityStyles(activeFinding.severity)?.bg
                              } ${getSeverityStyles(activeFinding.severity)?.text}`}>
                                {activeFinding.severity} RISK
                              </span>
                              <span className="font-mono text-[10px] text-zinc-500">
                                CATEGORY: {activeFinding.category}
                              </span>
                            </div>
                            <h3 className="text-base font-bold font-display text-[#1E2522]">
                              {activeFinding.title}
                            </h3>
                          </div>
                          
                          <span className={`px-2.5 py-0.5 rounded font-mono font-bold text-[10px] ${getStatusBadge(activeFinding.status)} shrink-0`}>
                            {activeFinding.status}
                          </span>
                        </div>

                        <div className="flex gap-4 font-mono text-[10px] text-[#717A75] border-t border-[#EAE6DF] pt-3 z-10 relative">
                          <span>FILEPATH: <span className="text-zinc-800 font-bold">{activeFinding.filepath}</span></span>
                          <span>LINE INDEX: <span className="text-zinc-800 font-bold">:{activeFinding.line}</span></span>
                        </div>
                      </div>

                      {/* Description Panel */}
                      <div className="space-y-1.5">
                        <h4 className="text-[11px] font-mono tracking-wider font-bold text-[#8A958F] uppercase">
                          VULNERABILITY DESCRIPTION
                        </h4>
                        <p className="text-xs text-zinc-800 leading-relaxed font-sans bg-zinc-50/50 p-3 border border-[#EAE6DF]/60 rounded select-text">
                          {activeFinding.description}
                        </p>
                      </div>

                      {/* Code Snippet block */}
                      <FindingSourceEvidence finding={activeFinding} title="Source code evidence" />

                      {/* Active Trace flow steps */}
                      {((activeFinding.trace && activeFinding.trace.length > 0) || lineageEntries.length > 0) && (
                        <div className="space-y-4">
                          <h4 className="text-[11px] font-mono tracking-wider font-bold text-[#8A958F] uppercase flex items-center gap-1 mr-1">
                            <CornerDownRight size={12} />
                            Active Data / Request Trace Flow
                          </h4>

                          <div className="relative border border-[#EAE6DF] rounded bg-[#FAF8F5]/30 p-4 space-y-4">
                            {activeFinding.trace.map((step, idx) => (
                              <div key={idx} className="relative flex gap-4">
                                {idx < activeFinding.trace.length - 1 && (
                                  <div className="w-[1px] absolute left-2.5 top-6 bottom-0 bg-[#EAE6DF] border-dashed border-l" />
                                )}
                                
                                <div className="w-5 h-5 rounded-full bg-emerald-950 text-white flex items-center justify-center font-mono text-[10px] font-bold shrink-0 mt-0.5">
                                  {step.step}
                                </div>

                                <div className="space-y-1 bg-white border border-[#EAE6DF] rounded p-3 text-xs w-full shadow-sm hover:border-zinc-400 transition-all select-text">
                                  <div className="flex justify-between items-center">
                                    <span className="font-bold text-[#1E2522] uppercase tracking-wide text-[10px] font-mono">
                                      {step.location}
                                    </span>
                                    <span className="font-mono text-[9px] text-[#8A958F]">Step Node {step.step}</span>
                                  </div>
                                  <p className="text-[#5C6560] leading-relaxed select-text">
                                    {step.description}
                                  </p>
                                  {step.codeSnippet && (
                                    <pre className="p-1 px-2 mt-1.5 font-mono text-[10px] rounded bg-stone-900 text-stone-100 overflow-x-auto">
                                      {step.codeSnippet}
                                    </pre>
                                  )}
                                </div>
                              </div>
                            ))}
                            {lineageEntries
                              .filter((entry) => entry.id === activeFinding.id || entry.parentId === activeFinding.id)
                              .map((entry, idx) => (
                                <div key={`lineage-${entry.id}-${idx}`} className="relative flex gap-4">
                                  <div className="w-5 h-5 rounded-full bg-orange-700 text-white flex items-center justify-center font-mono text-[10px] font-bold shrink-0 mt-0.5">
                                    L
                                  </div>
                                  <div className="space-y-1 bg-orange-50 border border-orange-200 rounded p-3 text-xs w-full">
                                    <span className="font-mono text-[9px] uppercase text-orange-800">{entry.stage}</span>
                                    <p className="text-[#5C6560]">{entry.label}</p>
                                  </div>
                                </div>
                              ))}
                          </div>
                        </div>
                      )}

                      {/* AI Reasoning notes */}
                      <div className="p-4 border border-[#EAE6DF] bg-[#F2EFF6]/20 rounded space-y-2 select-text">
                        <h4 className="text-[10px] font-mono tracking-wider font-bold text-emerald-900 uppercase flex items-center gap-1.5">
                          <Sparkles size={12} className="text-emerald-700 animate-pulse" />
                          Premortem AI Analysis & Confidence Trace
                        </h4>
                        <p className="text-xs text-neutral-700 leading-relaxed font-sans">
                          {activeFinding.aiReasoning}
                        </p>
                      </div>

                      {/* Code remedial recommendations */}
                      <div className="space-y-2">
                        <h4 className="text-[11px] font-mono tracking-wider font-bold text-[#8A958F] uppercase flex items-center gap-1">
                          <FolderLock size={12} />
                          REMEDIATION RECOMMENDATION
                        </h4>
                        <div className="p-4 bg-emerald-50/50 border border-emerald-200/60 rounded text-xs leading-relaxed text-zinc-800">
                          {activeFinding.recommendation}
                        </div>
                      </div>

                      {/* Canonical published issue body preview */}
                      {activeFinding.publishedIssueBodyMarkdown && (
                        <div className="space-y-3">
                          <h4 className="text-[11px] font-mono tracking-wider font-bold text-indigo-700 uppercase flex items-center gap-1">
                            <FileText size={12} />
                            Canonical Published Issue Body
                          </h4>
                          <p className="text-[10px] font-mono text-[#717A75] uppercase tracking-wider">
                            Exact markdown body used for GitLab and GitHub publish, including the evidence comparison block and attribution footer.
                          </p>
                          <pre className="p-4 bg-neutral-950 text-neutral-100 border border-neutral-900 rounded font-mono text-[10px] overflow-x-auto whitespace-pre-wrap leading-relaxed select-text">
                            {activeFinding.publishedIssueBodyMarkdown}
                          </pre>
                        </div>
                      )}

                      {/* Base Actions Bar */}
                      <div className="border-t border-[#EAE6DF] pt-6 flex flex-col sm:flex-row justify-between items-stretch sm:items-center gap-4">
                        <div className="flex gap-2 text-xs">
                          <button
                            onClick={() => onUpdateFindingStatus(selectedAudit.id, activeFinding.id, ConsoleReviewAction.CONFIRM)}
                            disabled={activeFinding.status === ConsoleIssueStatus.CONFIRMED}
                            className="py-2 px-3 border border-[#EAE6DF] rounded font-semibold text-[#1E2522] hover:bg-[#FAF8F5] transition-all flex items-center gap-1.5 disabled:opacity-50 cursor-pointer"
                          >
                            <ThumbsUp size={12} className="text-amber-500" />
                            <span>Confirm Finding</span>
                          </button>

                          <button
                            onClick={() => onUpdateFindingStatus(selectedAudit.id, activeFinding.id, ConsoleReviewAction.DISMISS)}
                            disabled={activeFinding.status === ConsoleIssueStatus.DISMISSED}
                            className="py-2 px-3 border border-[#EAE6DF] rounded font-semibold text-[#1E2522] hover:bg-[#FAF8F5] transition-all flex items-center gap-1.5 disabled:opacity-50 cursor-pointer"
                          >
                            <Ban size={12} className="text-stone-400" />
                            <span>Dismiss (False Positive)</span>
                          </button>
                        </div>

                        {activeFinding.suggestedPatchCode && activeFinding.status !== 'RESOLVED' && (
                          <button
                            onClick={() => onDeployPatch(selectedAudit.id, activeFinding.id)}
                            disabled={isPatching}
                            className="py-2 px-4 bg-emerald-950 text-white rounded font-semibold hover:bg-emerald-900 transition-all flex items-center justify-center gap-1.5 text-xs shadow-sm cursor-pointer disabled:opacity-50"
                          >
                            {isPatching ? (
                              <>
                                <RotateCw size={12} className="animate-spin" />
                                <span>Remediating Source Asset...</span>
                              </>
                            ) : (
                              <>
                                <Wrench size={12} />
                                <span>Deploy Telemetry Secure Patch</span>
                              </>
                            )}
                          </button>
                        )}

                        {activeFinding.status === 'RESOLVED' && (
                          <div className="py-2 px-4 bg-emerald-100 text-emerald-800 font-bold border border-emerald-200 rounded flex items-center gap-1.5 text-xs">
                            <Check size={14} strokeWidth={3} />
                            <span>SECURITY PATCH RE-DEPLOYED SUCCESSFULLY</span>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* MODE B: GITLAB ISSUE SYNTHESIS DESK */}
                  {workspaceMode === 'synthesis' && (
                    <div className="space-y-6 animate-fadeIn select-none">
                      
                      {/* GitLab Branded Status Banner */}
                      <div className="p-5 border rounded-lg bg-orange-50/40 border-orange-200 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2.5">
                            <span className="p-1 px-2 bg-orange-500 rounded text-stone-100 font-mono font-bold text-[10px] tracking-wider flex items-center gap-1.5">
                              <ProviderIcon 
                                slug="gitlab"
                                className="w-3 h-3 inline invert"
                              />
                              <span>GitLab MCP</span>
                            </span>
                            <h3 className="font-bold text-[#1E2522] uppercase tracking-wide text-xs">
                              Issue Staging Center
                            </h3>
                          </div>
                          <p className="text-[11px] text-[#717A75] leading-relaxed max-w-xl">
                            Synthesize a fully structured risk item suited for GitLab issue tracker. Edit details, resolve duplicates via merge, or approve for creation.
                          </p>
                        </div>

                        {isPublishedIssueUrl(activeFinding.gitlabIssueId) ? (
                          <div className="p-2.5 bg-emerald-955 text-white bg-emerald-950 rounded flex items-center gap-2 text-xs font-mono font-bold shadow-sm">
                            <CheckSquare size={14} className="text-emerald-400" />
                            <span className="truncate">CREATED AS {activeFinding.gitlabIssueId}</span>
                          </div>
                        ) : (
                          <div className="p-2 px-3 bg-orange-100 ring-1 ring-orange-200 text-orange-850 font-bold font-mono text-[9.5px] rounded animate-pulse self-start md:self-auto">
                            • STAGED DESIGN PROPOSAL
                          </div>
                        )}
                      </div>

                      {/* EDITABLE ISSUE FIELDS FORM */}
                      <div className="space-y-5 border border-zinc-200 rounded-lg p-5 bg-[#FAF8F5]/30">
                        {/* 1. Problem / title */}
                        <div className="space-y-1.5 text-xs">
                          <label className="block font-mono font-bold text-zinc-600 uppercase tracking-wide text-[9.5px]">
                            Consolidated Problem Title (Editable)
                          </label>
                          <input 
                            type="text" 
                            value={activeFinding.title}
                            onChange={(e) => handleFieldChange('title', e.target.value)}
                            className="w-full p-2.5 bg-white border border-[#EAE6DF] rounded text-xs text-zinc-955 font-semibold focus:ring-1 focus:ring-emerald-950 focus:outline-none"
                          />
                        </div>

                        {/* 2. Structured Failure Problem Description */}
                        <div className="space-y-1.5 text-xs">
                          <label className="block font-mono font-bold text-zinc-600 uppercase tracking-wide text-[9.5px]">
                            1. Failure Problem Description (Observed code/behaviors)
                          </label>
                          <textarea 
                            rows={3}
                            value={activeFinding.description}
                            onChange={(e) => handleFieldChange('description', e.target.value)}
                            className="w-full p-2.5 bg-white border border-[#EAE6DF] rounded text-xs text-zinc-800 leading-relaxed font-sans focus:ring-1 focus:ring-emerald-950 focus:outline-none"
                          />
                        </div>

                        {/* 3. Expected Behavior */}
                        <div className="space-y-1.5 text-xs">
                          <label className="block font-mono font-bold text-zinc-600 uppercase tracking-wide text-[9.5px]">
                            2. Expected Secure Behavior (Perspectives of maintainers)
                          </label>
                          <textarea 
                            rows={3}
                            value={synthesisField(activeFinding.expectedBehavior, 'expected behavior')}
                            placeholder="Expected secure behavior from runtime synthesis (edit to enrich before publish)"
                            onChange={(e) => handleFieldChange('expectedBehavior', e.target.value)}
                            className="w-full p-2.5 bg-white border border-[#EAE6DF] rounded text-xs text-zinc-800 leading-relaxed font-sans focus:ring-1 focus:ring-emerald-950 focus:outline-none"
                          />
                        </div>

                        {/* 4. Suggested Fix */}
                        <div className="space-y-1.5 text-xs">
                          <label className="block font-mono font-bold text-zinc-600 uppercase tracking-wide text-[9.5px]">
                            3. Suggested Refactoring Fix Strategies
                          </label>
                          <textarea 
                            rows={3}
                            value={activeFinding.recommendation}
                            onChange={(e) => handleFieldChange('recommendation', e.target.value)}
                            className="w-full p-2.5 bg-white border border-[#EAE6DF] rounded text-xs text-zinc-800 leading-relaxed font-mono text-[11px] focus:ring-1 focus:ring-emerald-950 focus:outline-none"
                          />
                        </div>

                        {/* 5. Success Criteria */}
                        <div className="space-y-1.5 text-xs">
                          <label className="block font-mono font-bold text-zinc-600 uppercase tracking-wide text-[9.5px]">
                            4. Success Conditions for Closure (Testable test cases)
                          </label>
                          <textarea 
                            rows={3}
                            value={synthesisField(activeFinding.successCriteria, 'success criteria')}
                            placeholder="Testable success criteria from runtime (edit before publish)"
                            onChange={(e) => handleFieldChange('successCriteria', e.target.value)}
                            className="w-full p-2.5 bg-white border border-[#EAE6DF] rounded text-xs text-zinc-800 leading-relaxed font-sans focus:ring-1 focus:ring-emerald-950 focus:outline-none"
                          />
                        </div>

                        {/* 6. Why It Matters */}
                        <div className="space-y-1.5 text-xs">
                          <label className="block font-mono font-bold text-zinc-600 uppercase tracking-wide text-[9.5px]">
                            5. Why It Matters (DX or reliability impacts justification)
                          </label>
                          <textarea 
                            rows={3}
                            value={synthesisField(activeFinding.whyItMatters, 'why it matters')}
                            placeholder="Business impact rationale from runtime synthesis"
                            onChange={(e) => handleFieldChange('whyItMatters', e.target.value)}
                            className="w-full p-2.5 bg-white border border-[#EAE6DF] rounded text-xs text-zinc-800 leading-relaxed font-sans focus:ring-1 focus:ring-emerald-950 focus:outline-none"
                          />
                        </div>
                      </div>

                      <div className="flex justify-end">
                        <button
                          type="button"
                          onClick={handleSaveSynthesis}
                          disabled={isSavingSynthesis}
                          className="py-2 px-4 border border-emerald-950 text-emerald-950 hover:bg-emerald-950 hover:text-white rounded font-bold flex items-center gap-2 text-xs transition-all disabled:opacity-50"
                        >
                          <Save size={13} />
                          {isSavingSynthesis ? 'Saving…' : 'Save Synthesis to Runtime'}
                        </button>
                      </div>

                      {/* ADVANCED MULTI-ANGLE DEDUPLICATION WORK DESK */}
                      <div className="p-5 border border-[#EAE6DF] rounded-lg bg-zinc-50 space-y-4">
                        <div className="flex items-center gap-1.5 text-xs font-bold text-zinc-800 uppercase tracking-wide">
                          <GitMerge size={14} className="text-emerald-800" />
                          <span>Group / Merge Overlapping Risk Findings (De-duplicate)</span>
                        </div>
                        <p className="text-xs text-zinc-500 leading-relaxed mt-1">
                          The orchestrator clusters related problems. Select similar risks yielded inside this audit to combine into this single parent issue task.
                        </p>

                        <div className="mt-3 space-y-2 text-xs">
                          <select
                            value={mergeTargetId}
                            onChange={(e) => setMergeTargetId(e.target.value)}
                            className="w-full min-w-0 p-2 border border-[#EAE6DF] rounded bg-white font-sans focus:outline-none focus:border-emerald-950 text-neutral-800"
                          >
                            <option value="">-- Choose overlapping duplicate finding to merge --</option>
                            {findings
                              .filter(f => f.id !== activeFinding.id && !f.mergedIntoId)
                              .map(f => (
                                <option key={f.id} value={f.id}>
                                  [{f.severity}] {f.title} ({f.filepath})
                                </option>
                              ))}
                          </select>

                          <div className="flex justify-end">
                            <button
                              type="button"
                              onClick={handleMergeFindings}
                              disabled={!mergeTargetId}
                              className="shrink-0 whitespace-nowrap px-4 py-2 bg-emerald-950 hover:bg-emerald-900 border border-emerald-950 text-white rounded font-bold transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                            >
                              Merge Selected
                            </button>
                          </div>
                        </div>
                      </div>

                      {/* SPLITTING OPERATIONS MODULE */}
                      <div className="p-5 border border-zinc-200 bg-[#FAF8F5]/45 rounded-lg flex flex-col gap-4 text-xs">
                        <div>
                          <h4 className="font-bold text-zinc-800 uppercase tracking-wide text-[11px] flex items-center gap-1">
                            <Layers size={13} />
                            Split Action Item Proposals
                          </h4>
                          <p className="text-zinc-500 leading-relaxed text-[11px] mt-0.5 max-w-sm">
                            Create a separate issue candidate when part of this risk should be tracked independently.
                          </p>
                        </div>

                        <div className="space-y-2">
                          <input
                            type="text"
                            value={splitTitle}
                            onChange={(e) => setSplitTitle(e.target.value)}
                            placeholder={`${activeFinding.title} (Follow-up)`}
                            className="w-full min-w-0 p-2 border border-[#EAE6DF] rounded bg-white font-sans focus:outline-none focus:border-emerald-950 text-neutral-800"
                          />
                          <div className="flex justify-end">
                            <button
                              type="button"
                              onClick={handleSplitFinding}
                              disabled={isSplitting}
                              className="shrink-0 whitespace-nowrap py-2 px-3 border border-[#EAE6DF] rounded font-bold hover:bg-[#FAF8F5] text-zinc-700 hover:text-zinc-950 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                            >
                              {isSplitting ? 'Splitting...' : 'Split Into Separate Task'}
                            </button>
                          </div>
                        </div>
                      </div>

                      {/* APPROVE & PUSH TO GITLAB INTEGRATION */}
                      <div className="border-t border-zinc-250 pt-6 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
                        <div className="text-xs text-[#5C6560]">
                          {isPublishedIssueUrl(activeFinding.gitlabIssueId) ? (
                            <span className="text-emerald-700 font-bold flex items-center gap-1.5 uppercase font-mono">
                              <CheckSquare size={14} className="text-emerald-600 animate-pulse" />
                              Issue successfully created and synchronized with GitLab.
                            </span>
                          ) : (
                            <span className="font-sans">
                              Staged for GitLab board. Creates a fully complete back-log item package.
                            </span>
                          )}
                        </div>

                        {isPublishedIssueUrl(activeFinding.gitlabIssueId) ? (
                          <a
                            href={activeFinding.gitlabIssueId}
                            target="_blank"
                            rel="referrer noopener"
                            className="py-2 px-4 bg-orange-600 hover:bg-orange-700 text-white font-bold rounded flex items-center justify-center gap-2 text-xs shadow transition-all cursor-pointer uppercase select-none font-mono"
                          >
                            <ProviderIcon 
                              slug="gitlab"
                              className="w-3.5 h-3.5 inline invert"
                            />
                            <span>Open GitLab Issue Details</span>
                            <ExternalLink size={12} />
                          </a>
                        ) : (
                          <button
                            type="button"
                            onClick={handlePushToGitLab}
                            disabled={isSyncingToGitLab}
                            className="py-2.5 px-5 bg-orange-500 hover:bg-orange-600 text-white font-bold rounded flex items-center justify-center gap-2 text-xs shadow-md transition-all cursor-pointer disabled:opacity-50 select-none uppercase font-mono tracking-wide"
                          >
                            {isSyncingToGitLab ? (
                              <>
                                <RotateCw size={13} className="animate-spin" />
                                <span>Exporting to GitLab Backlog...</span>
                              </>
                            ) : (
                              <>
                                <ProviderIcon 
                                  slug="gitlab"
                                  className="w-4 h-4 inline invert"
                                />
                                <span>Approve & Create GitLab Issue</span>
                              </>
                            )}
                          </button>
                        )}
                      </div>

                    </div>
                  )}

                </div>
              ) : (
                <div className="flex-1 overflow-y-auto p-12 text-center text-xs text-[#5C6560] italic">
                  Select a vulnerability from the left checklist to view detailed path tracing.
                </div>
              )}
            </div>
          )}

          {/* TAB 3: SWARM ORCHESTRATION PLAN DESK */}
          {activeTab === 'swarm' && (
            <div className="p-6 overflow-y-auto h-full space-y-6 animate-fadeIn text-xs font-sans">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4 bg-zinc-50 border border-[#EAE6DF] p-5 rounded-lg">
                <div className="md:col-span-2 space-y-1">
                  <h4 className="font-bold text-[#1E2522] uppercase tracking-wide text-xs flex items-center gap-1.5">
                    <Activity size={14} className="text-emerald-700" />
                    Swarm orchestration plan
                  </h4>
                  <p className="text-[#5C6560] leading-relaxed text-[11px]">
                    Specialist agents run in parallel across repository and runtime lenses. The checkpoint shows the current phase, completed specialists, and persisted graph state.
                  </p>
                </div>

                <div className="p-3 bg-white border border-[#EAE6DF] rounded text-center space-y-1">
                  <span className="block text-[9px] uppercase tracking-wider font-mono text-[#8A958F]">CURRENT PHASE</span>
                  <p className="text-xl font-bold font-display text-zinc-900">
                    {runtimeCheckpoint?.phase?.replace(/_/g, ' ') ?? selectedAudit.status}
                  </p>
                </div>

                <div className="p-3 bg-white border border-[#EAE6DF] rounded text-center space-y-1">
                  <span className="block text-[9px] uppercase tracking-wider font-mono text-[#8A958F]">COOPERATING AGENTS</span>
                  <p className="text-xl font-bold font-display text-zinc-900">{swarmAgents.length} Active Lenses</p>
                </div>

                <div className="p-3 bg-white border border-[#EAE6DF] rounded text-center space-y-1">
                  <span className="block text-[9px] uppercase tracking-wider font-mono text-[#8A958F]">GRAPH MEMORY</span>
                  <span className="inline-flex py-0.5 px-2 bg-emerald-100 border border-emerald-200 text-emerald-800 rounded font-mono font-bold text-[9px] mt-1">
                    {graphNodeCount} NODES · {lineageEntries.length} LINEAGE
                  </span>
                </div>
              </div>

              <AuditRuntimeConsole
                auditId={selectedAudit.id}
                auditStatus={selectedAudit.status}
                agentRuns={runtimeAgentRuns}
                events={runtimeSnapshot?.events ?? []}
                summary={runtimeSnapshot?.summary}
                onStopAll={onStopAllRuntime}
                onResume={onResumeAudit}
                showStopAll={showStopAll}
                isStopAllPending={isStopAllPending}
                isResumePending={isResumePending}
              />

              {swarmAgents.length === 0 ? (
                <div className="p-6 border border-dashed border-[#EAE6DF] rounded text-center text-[#5C6560]">
                  No specialist agent runs loaded yet. Select a completed audit or trigger a new run.
                </div>
              ) : (
                <SwarmDualLanePanel
                  repositoryAgents={repositoryAgents}
                  runtimeAgents={runtimeAgents}
                  timeline={swarmTimeline}
                  activeAgentId={activeAgentId}
                  onSelectAgent={setActiveAgentId}
                />
              )}

              {selectedAgent ? (
                <div className="space-y-2">
                  <div className="flex justify-between items-center text-[11px] font-mono text-[#8A958F]">
                    <span className="font-bold uppercase flex items-center gap-1.5">
                      <Terminal size={12} />
                      Agent telemetry buffer
                    </span>
                    <span>Agent Instance: {selectedAgent.name}</span>
                  </div>

                  <div className="bg-neutral-950 font-mono text-[11px] text-zinc-300 rounded-lg p-5 overflow-hidden shadow-inner border border-neutral-800 leading-relaxed max-h-48 overflow-y-auto">
                    <div className="space-y-1 selection:bg-zinc-700 select-text">
                      {selectedAgent.logs.map((log, idx) => (
                        <p
                          key={idx}
                          className={
                            log.includes('CRITICAL') || log.includes('HIGH')
                              ? 'text-rose-500 font-bold'
                              : log.includes('MEDIUM')
                                ? 'text-amber-500'
                                : 'text-zinc-300'
                          }
                        >
                          &gt; [{selectedAgent.id.toUpperCase()}] {log}
                        </p>
                      ))}
                    </div>
                  </div>
                </div>
              ) : null}
            </div>
          )}

        </div>
      </div>
      <OsToast message={toastMessage ?? ''} tone={toastTone} />
    </div>
  );
}
