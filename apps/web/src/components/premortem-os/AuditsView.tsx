'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import type { RuntimeAuditSnapshot } from '@/lib/premortem-api/client';
import { buildOsQueryKey, type OsQueryScope } from '@/hooks/use-os-console-data';
import { isUnauthorizedBffError, shouldRetryBffQuery } from '@/lib/bff-client';
import { premortemBrand } from '@/lib/premortem-os/branding';
import {
  formatDateTime,
  safeNumber,
  safeText,
  safeUppercase
} from '@/lib/premortem-os/format';
import { AuditRun, Finding, TraceStep, SeverityType, ConsoleReviewActionValue, RiskCluster } from '@/lib/premortem-os/types';
import { mapFindingComplianceFromAudit, mapSnapshotToAuditRun } from '@/lib/premortem-api/map-runtime-to-console';
import { ConsoleReviewAction, ConsoleIssueStatus } from '@premortem/domain';
import { AuditsInvestigationsPanel } from './audits-investigations-panel';
import { AuditRuntimeConsole } from './audit-runtime-console';
import { FindingSourceEvidence } from './finding-source-evidence';
import { SwarmDualLanePanel } from './swarm-dual-lane-panel';
import { OsEmptyState } from './os-empty-state';
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
  Download,
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
import {
  AiCheckpointCard,
  AiReasoningCard,
  AiTaskList
} from './ai-elements';

const synthesisField = (value: string | undefined) => (value?.trim() ? value : '');

const severityStylesMap: Record<SeverityType, { text: string; bg: string; dot: string }> = {
  CRITICAL: { text: 'text-rose-600', bg: 'bg-rose-50 border-rose-200', dot: 'bg-rose-600' },
  HIGH: { text: 'text-amber-600', bg: 'bg-amber-50 border-amber-200', dot: 'bg-amber-500' },
  MEDIUM: { text: 'text-indigo-600', bg: 'bg-indigo-50 border-indigo-200', dot: 'bg-indigo-500' },
  LOW: { text: 'text-emerald-600', bg: 'bg-emerald-50 border-emerald-200', dot: 'bg-emerald-500' }
};

const statusBadgeMap: Record<string, string> = {
  OPEN: 'bg-zinc-100 text-zinc-700 border border-zinc-200',
  CONFIRMED: 'bg-amber-50 text-amber-700 border border-amber-200 uppercase font-bold',
  DISMISSED: 'bg-stone-100 text-stone-500 border border-stone-200 line-through',
  RESOLVED: 'bg-emerald-50 text-emerald-800 border border-emerald-200 font-bold',
  PUBLISHED: 'bg-orange-50 text-orange-800 border border-orange-200 font-bold uppercase'
};
const ACTIVE_AUDIT_STATUSES = new Set(['RUNNING', 'PAUSED', 'QUEUED']);

function isValidAuditId(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0 && value !== 'null' && value !== 'undefined';
}

function pickMostRecentCompletedAudit(audits: AuditRun[]) {
  return audits.reduce<AuditRun | null>((latest, audit) => {
    if (audit.status !== 'COMPLETED') return latest;
    if (!latest) return audit;
    const latestTime = new Date(latest.date).getTime();
    const currentTime = new Date(audit.date).getTime();
    if (Number.isNaN(latestTime) && Number.isNaN(currentTime)) return latest;
    if (Number.isNaN(latestTime)) return audit;
    if (Number.isNaN(currentTime)) return latest;
    return currentTime > latestTime ? audit : latest;
  }, null);
}

function getSeverityStyles(severity: SeverityType) {
  return severityStylesMap[severity];
}

function getStatusBadge(status: string) {
  return statusBadgeMap[status] ?? 'bg-zinc-100 text-zinc-700';
}

interface AuditsViewProps {
  queryScope?: OsQueryScope;
  audits: AuditRun[];
  selectedAuditId: string | null;
  focusCluster?: RiskCluster | null;
  onSelectAudit: (auditId: string) => void;
  onUpdateFindingStatus: (auditId: string, issueId: string, action: ConsoleReviewActionValue) => void;
  onUpdateFindingFields: (auditId: string, findingId: string, fields: Partial<Finding>) => void;
  onPersistFindingFields: (auditId: string, findingId: string, fields: Partial<Finding>) => Promise<void>;
  onAuditHydrated: (auditId: string, audit: AuditRun) => void;
  onDeployPatch: (auditId: string, issueId: string) => void;
  isPatching: boolean;
  onTriggerScan: (projectId: string) => void;
  runtimeModeLabel?: string;
  onStartAudit?: () => void | Promise<void>;
  onPauseAudit?: (auditId: string) => void | Promise<void>;
  onStopAllRuntime?: () => void | Promise<void>;
  onResumeAudit?: (auditId: string) => void | Promise<void>;
  showStopAll?: boolean;
  isStartAuditPending?: boolean;
  isPausePending?: boolean;
  isStopAllPending?: boolean;
  isResumePending?: boolean;
}

export function AuditsView({
  queryScope = null,
  audits,
  selectedAuditId,
  focusCluster = null,
  onSelectAudit,
  onUpdateFindingStatus,
  onUpdateFindingFields,
  onPersistFindingFields,
  onAuditHydrated,
  onDeployPatch,
  isPatching,
  onTriggerScan,
  runtimeModeLabel = 'Manual',
  onStartAudit,
  onPauseAudit,
  onStopAllRuntime,
  onResumeAudit,
  showStopAll = false,
  isStartAuditPending = false,
  isPausePending = false,
  isStopAllPending = false,
  isResumePending = false
}: AuditsViewProps) {
  const [activeTab, setActiveTab] = useState<'summary' | 'findings' | 'swarm'>('summary');
  const [selectedFindingId, setSelectedFindingId] = useState<string | null>(null);
  const [severityFilter, setSeverityFilter] = useState<'ALL' | SeverityType>('ALL');

  // GitLab Issue synthesis mode variables
  const [workspaceMode, setWorkspaceMode] = useState<'inspect' | 'synthesis'>('inspect');
  const [isSyncingToGitLab, setIsSyncingToGitLab] = useState(false);
  const [isSavingSynthesis, setIsSavingSynthesis] = useState(false);
  const [isExportingSarif, setIsExportingSarif] = useState(false);
  const [mergeTargetId, setMergeTargetId] = useState<string>('');
  const [splitTitle, setSplitTitle] = useState('');
  const [isSplitting, setIsSplitting] = useState(false);
  const [activeAgentId, setActiveAgentId] = useState<string>('');
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [toastTone, setToastTone] = useState<'success' | 'error'>('success');
  const focusedClusterKeyRef = useRef<string | null>(null);
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const latestCompletedAudit = useMemo(
    () => pickMostRecentCompletedAudit(audits),
    [audits]
  );
  const selectedAudit =
    audits.find((a) => a.id === selectedAuditId) ||
    latestCompletedAudit ||
    audits[0];
  const selectedAuditRecordId = isValidAuditId(selectedAuditId)
    ? selectedAuditId
    : isValidAuditId(selectedAudit?.id)
      ? selectedAudit.id
      : '';
  const shouldPollSnapshot =
    (selectedAudit ? ACTIVE_AUDIT_STATUSES.has(selectedAudit.status) : false) ||
    activeTab === 'swarm';
  const { data: runtimeSnapshot } = useQuery<RuntimeAuditSnapshot | null>({
    queryKey: buildOsQueryKey(queryScope, 'audit-runtime-snapshot', selectedAuditRecordId),
    enabled: selectedAuditRecordId.length > 0,
    staleTime: 15_000,
    refetchOnMount: false,
    refetchOnWindowFocus: false,
    retry: shouldRetryBffQuery,
    refetchInterval: (query) => {
      if (isUnauthorizedBffError(query.state.error)) return false;
      return shouldPollSnapshot ? 5000 : false;
    },
    queryFn: async (): Promise<RuntimeAuditSnapshot | null> => {
      const response = await fetch(`/api/audits/${selectedAuditRecordId}?hydrate=1`, {
        cache: 'no-store'
      });
      if (!response.ok) {
        throw new Error('Failed to load audit snapshot.');
      }
      const payload = await response.json();
      const snapshot = payload.snapshot ?? payload.auditRun ?? null;
      if (snapshot) {
        const hydrated = mapSnapshotToAuditRun(
          snapshot,
          safeText(selectedAudit?.projectName, 'Selected project'),
          selectedAudit?.date
        );
        onAuditHydrated(selectedAuditRecordId, hydrated);
      }
      return snapshot as RuntimeAuditSnapshot | null;
    }
  });
  const runtimeCheckpoint = parseAuditCheckpoint(runtimeSnapshot?.summary);
  const activeAudit = useMemo(() => {
    if (!runtimeSnapshot || !selectedAudit) return selectedAudit ?? null;
    return mapSnapshotToAuditRun(
      runtimeSnapshot,
      safeText(selectedAudit.projectName, 'Selected project'),
      selectedAudit.date
    );
  }, [runtimeSnapshot, selectedAudit]);
  const selectedAuditScore = safeNumber(activeAudit?.score, 0);
  const currentCompliance = activeAudit ? mapFindingComplianceFromAudit(activeAudit) : null;

  const showToast = (message: string, tone: 'success' | 'error' = 'success') => {
    setToastMessage(message);
    setToastTone(tone);
    if (toastTimerRef.current) {
      clearTimeout(toastTimerRef.current);
    }
    toastTimerRef.current = setTimeout(() => setToastMessage(null), 3050);
  };

  useEffect(
    () => () => {
      if (toastTimerRef.current) {
        clearTimeout(toastTimerRef.current);
      }
    },
    []
  );

  const setSeverityFilterFromValue = (value: string) => {
    if (value === 'ALL') {
      setSeverityFilter('ALL');
      return;
    }

    if (value === 'CRITICAL' || value === 'HIGH' || value === 'MEDIUM' || value === 'LOW') {
      setSeverityFilter(value.toLowerCase() as SeverityType);
    }
  };

  const findings = activeAudit?.findings ?? [];
  const defaultFindingId =
    findings.find((finding) => !finding.mergedIntoId)?.id ?? findings[0]?.id ?? null;
  const effectiveSelectedFindingId =
    selectedFindingId && findings.some((finding) => finding.id === selectedFindingId)
      ? selectedFindingId
      : defaultFindingId;
  const focusClusterForAudit =
    focusCluster && focusCluster.auditRunId === selectedAudit?.id ? focusCluster : null;
  const clusterKey = focusClusterForAudit
    ? `${selectedAudit?.id ?? 'unknown'}:${focusClusterForAudit.id}:${focusClusterForAudit.severity}`
    : null;
  const selectedAuditLineage = activeAudit?.lineage ?? [];

  useEffect(() => {
    focusedClusterKeyRef.current = null;
    setSeverityFilter('ALL');
    setSelectedFindingId(null);
  }, [selectedAudit?.id]);

  useEffect(() => {
    if (effectiveSelectedFindingId === selectedFindingId) return;
    setSelectedFindingId(effectiveSelectedFindingId);
  }, [effectiveSelectedFindingId, selectedFindingId]);

  useEffect(() => {
    if (!clusterKey || clusterKey === focusedClusterKeyRef.current) return;

    const clusterSeverity = focusClusterForAudit?.severity;
    const clusterIssueIds = new Set<string>();
    for (const entry of selectedAuditLineage) {
      if (entry.stage === 'issue_candidate' && entry.parentId === focusClusterForAudit!.id) {
        clusterIssueIds.add(entry.id);
      }
    }
    const clusterFinding =
      findings.find((finding) => clusterIssueIds.has(finding.id) && !finding.mergedIntoId) ??
      findings.find((finding) => finding.severity === clusterSeverity && !finding.mergedIntoId);
    focusedClusterKeyRef.current = clusterKey;
    setActiveTab('findings');
    setSeverityFilter(clusterSeverity ?? 'ALL');
    setSelectedFindingId(clusterFinding?.id ?? defaultFindingId);
  }, [clusterKey, defaultFindingId, findings, focusClusterForAudit, selectedAuditLineage]);

  if (!selectedAudit) {
    return (
      <div className="flex-1 overflow-y-auto p-8">
        <OsEmptyState
          icon={Activity}
          title="No audit runs yet"
          description="Register a project in Projects Inventory, then launch a security scan to populate this view."
          action={
            onStartAudit ? (
              <button
                type="button"
                onClick={() => void onStartAudit()}
                className="rounded border border-emerald-800 bg-emerald-950 px-4 py-2 text-[10px] font-mono font-bold uppercase tracking-wider text-[#72C8AF] transition-colors hover:bg-emerald-900"
              >
                Start audit
              </button>
            ) : null
          }
        />
      </div>
    );
  }
  
  // Exclude findings that have been merged into others to support a clean list
  const visibleFindings = [] as typeof findings;
  const filteredFindings = [] as typeof findings;
  for (const finding of findings) {
    if (finding.mergedIntoId) continue;
    visibleFindings.push(finding);
    if (severityFilter === 'ALL' || finding.severity === severityFilter) {
      filteredFindings.push(finding);
    }
  }

  const activeFinding =
    findings.find((finding) => finding.id === effectiveSelectedFindingId) ||
    filteredFindings[0] ||
    findings[0];
  const reasoningFinding = activeFinding ?? findings[0] ?? null;
  const reasoningEvidenceRefs = reasoningFinding?.evidenceRefs ?? [];
  const reasoningCheckpointPhase =
    runtimeCheckpoint?.phase?.replace(/_/g, ' ') ?? activeAudit?.status ?? selectedAudit.status;
  const reasoningSummary = reasoningFinding
    ? `Audit ${selectedAuditRecordId} is currently ${activeAudit?.status ?? selectedAudit.status.toLowerCase()} and the selected finding ${reasoningFinding.title} anchors the live reasoning trail at ${reasoningFinding.filepath}:${reasoningFinding.line}.`
    : `Audit ${selectedAuditRecordId} is currently ${activeAudit?.status ?? selectedAudit.status.toLowerCase()} with ${findings.length} findings and no selected finding. The panel stays live so reviewers can jump into the next actionable item instead of reading placeholder copy.`;
  const reasoningSteps = [
    `Checkpoint phase: ${reasoningCheckpointPhase}.`,
    `Findings in scope: ${findings.length}. Selected finding: ${reasoningFinding ? `${reasoningFinding.title} (${reasoningFinding.severity})` : 'none yet'}.`,
    reasoningFinding
      ? `Evidence refs: ${reasoningEvidenceRefs.length}. Source anchor: ${reasoningFinding.filepath}:${reasoningFinding.line}.`
      : 'Use Focus first finding to move the panel onto a concrete issue before publishing.'
  ];
  const handleFocusFirstFinding = () => {
    if (!defaultFindingId) return;
    setSelectedFindingId(defaultFindingId);
    setActiveTab('findings');
  };
  const handleOpenSwarmTrace = () => {
    setActiveTab('swarm');
  };
  const handleCopyReasoningPath = async () => {
    if (!reasoningFinding) return;
    const pathText = `${reasoningFinding.filepath}:${reasoningFinding.line}`;
    try {
      await navigator.clipboard.writeText(pathText);
      showToast(`Copied ${pathText}.`);
    } catch {
      showToast('Unable to copy reasoning path.', 'error');
    }
  };
  const handleCopyReasoningEvidence = async () => {
    if (!reasoningFinding) return;
    const evidenceText =
      reasoningFinding.evidenceRefs?.map((ref) => ref.ref).filter(Boolean).join('\n') ||
      reasoningFinding.evidence;
    try {
      await navigator.clipboard.writeText(evidenceText);
      showToast('Copied evidence trail.');
    } catch {
      showToast('Unable to copy evidence trail.', 'error');
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
      showToast(error instanceof Error ? error.message : 'Failed to save synthesis fields.', 'error');
    } finally {
      setIsSavingSynthesis(false);
    }
  };

  const handleExportSarif = async () => {
    if (!selectedAudit) return;

    setIsExportingSarif(true);
    try {
      const response = await fetch(`/api/audits/${selectedAudit.id}/sarif`, {
        headers: { accept: 'application/sarif+json' }
      });
      if (!response.ok) {
        const errPayload = await response.json().catch(() => ({}));
        throw new Error(
          typeof errPayload.error === 'string'
            ? errPayload.error
            : `SARIF export failed (${response.status})`
        );
      }

      const sarif = await response.text();
      const blob = new Blob([sarif], { type: 'application/sarif+json;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `premortem-audit-${selectedAudit.id}.sarif.json`;
      link.click();
      URL.revokeObjectURL(url);
      showToast('SARIF export downloaded.');
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Failed to export SARIF.', 'error');
    } finally {
      setIsExportingSarif(false);
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
          throw new Error(
            `${message} Free tier includes 3 publishes per month. Upgrade to Starter in Settings → Billing for unlimited publish.`,
          );
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
        showToast(
          'Publish dry-run only: no GitLab issue was created. Remove PREMORTEM_PUBLISH_DRY_RUN from .env.local and restart dev to create real GitLab issues.',
          'error'
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
      showToast(error instanceof Error ? error.message : 'Failed to publish to GitLab.', 'error');
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
      showToast('Failed to merge findings.', 'error');
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
            mapSnapshotToAuditRun(auditPayload.snapshot, selectedAudit.projectName, selectedAudit.date)
          );
        }
      }

      onUpdateFindingFields(selectedAudit.id, activeFinding.id, {
        isSplitted: true
      });
      setSplitTitle('');
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Failed to split finding.', 'error');
    } finally {
      setIsSplitting(false);
    }
  };

  const runtimeAgentRuns = runtimeSnapshot?.agentRuns ?? activeAudit?.agentRuns ?? [];
  const snapshotFindings = runtimeSnapshot?.findings ?? [];
  const swarmAgents: SwarmLaneAgent[] = runtimeAgentRuns.map((run) => {
    const agentFindings = snapshotFindings.filter((finding) => finding.agentRunId === run.id);
    const lineageLabels: string[] = [];
    for (const entry of runtimeSnapshot?.lineage ?? activeAudit?.lineage ?? []) {
      if (entry.parentId === run.id || entry.id === run.id) {
        lineageLabels.push(entry.label);
      }
    }
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
    runtimeSnapshot?.graphSnapshot?.nodeCount ?? activeAudit?.graphSnapshot?.nodeCount ?? 0;
  const lineageEntries = runtimeSnapshot?.lineage ?? activeAudit?.lineage ?? [];

  return (
    <div className="flex min-h-0 flex-1 overflow-hidden font-sans" id="audits-view-panel">
      <AuditsInvestigationsPanel
        audits={audits}
        selectedAuditId={selectedAuditRecordId}
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
                  REF: {safeUppercase(selectedAuditRecordId)}
                </span>
                <span className="text-[11px] font-mono text-[#717A75]">
                  Audited on {formatDateTime(activeAudit?.date ?? selectedAudit.date)}
                </span>
              </div>
              <h2 className="text-xl font-bold tracking-tight text-[#1E2522] font-display mt-2">
                {safeText(activeAudit?.projectName ?? selectedAudit.projectName, 'Selected project')} Continuous Security Audit
              </h2>
            </div>

            {/* Compliance Index Circular Gauge */}
              <div className="flex items-center gap-4 bg-[#F2EFF6]/60 p-3 rounded border border-[#EAE6DF] shrink-0 font-mono text-xs">
                <div>
                  <span className="block text-[8px] uppercase tracking-widest text-neutral-500">COMPLIANCE INDEX</span>
                  <span className="text-xl font-bold font-display text-zinc-900">{selectedAuditScore}%</span>
                </div>
                <div className="w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm bg-emerald-950 text-white shadow-inner">
                  {selectedAuditScore}
                </div>
              </div>
              <button
                type="button"
                onClick={() => void handleExportSarif()}
                disabled={isExportingSarif}
                className="inline-flex items-center gap-1.5 rounded border border-[#EAE6DF] bg-white px-3 py-2 text-[10px] font-mono font-bold uppercase tracking-[0.18em] text-[#1E2522] transition-colors hover:bg-[#FAF8F5] disabled:cursor-not-allowed disabled:opacity-60"
              >
                <Download size={12} aria-hidden />
                <span>{isExportingSarif ? 'Exporting SARIF' : 'Export SARIF'}</span>
              </button>
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
                    {currentCompliance ?? 'COMPLIANT'} · {findings.length} findings ·{' '}
                    {runtimeCheckpoint?.clusterCount ?? 0} clusters
                  </p>
                </div>
                <div className="p-4 bg-white border border-[#EAE6DF] rounded text-xs space-y-1">
                  <span className="block text-[10px] font-mono uppercase tracking-wider text-[#8A958F]">Execution milestone</span>
                  <p className="font-semibold text-[#1E2522]">
                    {runtimeCheckpoint?.phase?.replace(/_/g, ' ') ?? activeAudit?.status ?? selectedAudit.status}
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
                    {runtimeCheckpoint?.savedAt ? new Date(runtimeCheckpoint.savedAt).toLocaleString() : new Date(activeAudit?.date ?? selectedAudit.date).toLocaleString()}
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 xl:grid-cols-[1.05fr_0.95fr] gap-4">
                <div className="space-y-4">
                  <AiReasoningCard
                    title="Audit reasoning"
                    summary={reasoningSummary}
                    steps={reasoningSteps}
                  />

                  <div className="rounded-lg border border-[#EAE6DF] bg-white p-4 space-y-3">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="font-mono text-[10px] font-bold uppercase tracking-[0.24em] text-[#717A75]">
                          Live reviewer controls
                        </p>
                        <p className="mt-1 text-xs text-[#5C6560]">
                          This panel exists to bind the checkpoint, the selected finding, and its evidence trail to real reviewer actions.
                        </p>
                      </div>
                      <span className="inline-flex rounded border border-[#EAE6DF] bg-[#FAF8F5] px-2 py-1 font-mono text-[9px] font-bold uppercase tracking-[0.18em] text-[#5C6560]">
                        {reasoningFinding ? reasoningFinding.status : 'No finding selected'}
                      </span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[10px] font-mono">
                      <div className="rounded border border-[#EAE6DF] bg-[#FAF8F5] px-3 py-2">
                        <span className="block uppercase tracking-[0.18em] text-[#8A958F]">Checkpoint</span>
                        <p className="mt-1 text-[#1E2522] font-semibold">{reasoningCheckpointPhase}</p>
                      </div>
                      <div className="rounded border border-[#EAE6DF] bg-[#FAF8F5] px-3 py-2">
                        <span className="block uppercase tracking-[0.18em] text-[#8A958F]">Evidence refs</span>
                        <p className="mt-1 text-[#1E2522] font-semibold">
                          {reasoningFinding ? reasoningEvidenceRefs.length : 0}
                        </p>
                      </div>
                    </div>

                    {reasoningFinding ? (
                      <div className="rounded border border-emerald-200 bg-emerald-50/70 px-3 py-2 text-xs text-emerald-950">
                        <p className="font-semibold">{reasoningFinding.title}</p>
                        <p className="mt-1 font-mono text-[10px] uppercase tracking-[0.18em] text-emerald-800">
                          {reasoningFinding.filepath}:{reasoningFinding.line}
                        </p>
                        <p className="mt-2 leading-relaxed text-emerald-900/90">
                          {reasoningFinding.description}
                        </p>
                      </div>
                    ) : (
                      <div className="rounded border border-dashed border-[#EAE6DF] bg-[#FAF8F5] px-3 py-2 text-xs text-[#5C6560]">
                        Select a finding to bind the reasoning panel to a concrete issue.
                      </div>
                    )}

                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={handleFocusFirstFinding}
                        className="inline-flex items-center gap-1 rounded border border-emerald-800 bg-emerald-950 px-3 py-1.5 text-[10px] font-mono font-bold uppercase tracking-[0.18em] text-[#72C8AF] transition-colors hover:bg-emerald-900 disabled:cursor-not-allowed disabled:opacity-50"
                        disabled={!defaultFindingId}
                      >
                        Focus first finding
                      </button>
                      <button
                        type="button"
                        onClick={handleOpenSwarmTrace}
                        className="inline-flex items-center gap-1 rounded border border-[#EAE6DF] bg-white px-3 py-1.5 text-[10px] font-mono font-bold uppercase tracking-[0.18em] text-[#1E2522] transition-colors hover:bg-[#FAF8F5]"
                      >
                        Open swarm trace
                      </button>
                      <button
                        type="button"
                        onClick={handleCopyReasoningPath}
                        className="inline-flex items-center gap-1 rounded border border-[#EAE6DF] bg-white px-3 py-1.5 text-[10px] font-mono font-bold uppercase tracking-[0.18em] text-[#1E2522] transition-colors hover:bg-[#FAF8F5] disabled:cursor-not-allowed disabled:opacity-50"
                        disabled={!reasoningFinding}
                      >
                        Copy file path
                      </button>
                      <button
                        type="button"
                        onClick={handleCopyReasoningEvidence}
                        className="inline-flex items-center gap-1 rounded border border-[#EAE6DF] bg-white px-3 py-1.5 text-[10px] font-mono font-bold uppercase tracking-[0.18em] text-[#1E2522] transition-colors hover:bg-[#FAF8F5] disabled:cursor-not-allowed disabled:opacity-50"
                        disabled={!reasoningFinding}
                      >
                        Copy evidence trail
                      </button>
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  <AiCheckpointCard
                    item={{
                      phase: runtimeCheckpoint?.phase?.replace(/_/g, ' ') ?? activeAudit?.status ?? selectedAudit.status,
                      savedAt: runtimeCheckpoint?.savedAt
                        ? new Date(runtimeCheckpoint.savedAt).toLocaleString()
                        : new Date(activeAudit?.date ?? selectedAudit.date).toLocaleString(),
                      summary: runtimeCheckpoint
                        ? `Checkpoint captured ${runtimeCheckpoint.completedSpecialists.length} specialist(s), ${runtimeCheckpoint.findingCount} findings, and ${runtimeCheckpoint.clusterCount} clusters.`
                        : `No persisted checkpoint was found yet for this audit.`
                    }}
                  />

                  <AiTaskList
                    items={[
                      {
                        label: 'Trace review',
                        detail: 'Inspect the active finding, its source evidence, and the execution trace.',
                        state: activeAudit ? 'completed' : 'pending'
                      },
                      {
                        label: 'Finding review',
                        detail: 'Confirm, dismiss, split, or merge issues before publish.',
                        state: findings.length > 0 ? 'running' : 'pending'
                      },
                      {
                        label: 'Publish readiness',
                        detail: 'Validate GitLab synchronization and remediation state.',
                        state: isPublishedIssueUrl(activeAudit?.findings?.[0]?.gitlabIssueId) ? 'completed' : 'pending'
                      }
                    ]}
                  />
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
                              type="button"
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
                  <div className="p-8 text-center text-xs text-[#5C6560] space-y-3">
                    <p className="italic">No findings match the current severity filter.</p>
                    <button
                      type="button"
                      onClick={() => setSeverityFilter('ALL')}
                      className="inline-flex items-center justify-center rounded border border-[#EAE6DF] bg-white px-3 py-1.5 font-mono text-[10px] font-bold uppercase tracking-[0.2em] text-[#1E2522] transition-colors hover:bg-[#FAF8F5]"
                    >
                      Reset to all risk sizes
                    </button>
                  </div>
                ) : (
                  filteredFindings.map((f) => {
                    const sev = getSeverityStyles(f.severity);
                    const isSel = f.id === activeFinding?.id;
                    return (
                      <button
                        key={f.id}
                        type="button"
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
                              <div key={`${step.step}-${step.location}`} className="relative flex gap-4">
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
                            {lineageEntries.map((entry) =>
                              entry.id === activeFinding.id || entry.parentId === activeFinding.id ? (
                                <div key={`lineage-${entry.id}`} className="relative flex gap-4">
                                  <div className="w-5 h-5 rounded-full bg-orange-700 text-white flex items-center justify-center font-mono text-[10px] font-bold shrink-0 mt-0.5">
                                    L
                                  </div>
                                  <div className="space-y-1 bg-orange-50 border border-orange-200 rounded p-3 text-xs w-full">
                                    <span className="font-mono text-[9px] uppercase text-orange-800">{entry.stage}</span>
                                    <p className="text-[#5C6560]">{entry.label}</p>
                                  </div>
                                </div>
                              ) : null
                            )}
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
                        <div className="p-4 bg-emerald-50/50 border border-emerald-200/60 rounded text-xs leading-relaxed text-emerald-950">
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
                            type="button"
                            onClick={() => onUpdateFindingStatus(selectedAudit.id, activeFinding.id, ConsoleReviewAction.CONFIRM)}
                            disabled={activeFinding.status === ConsoleIssueStatus.CONFIRMED}
                            className="py-2 px-3 border border-[#EAE6DF] rounded font-semibold text-[#1E2522] hover:bg-[#FAF8F5] transition-all flex items-center gap-1.5 disabled:opacity-50 cursor-pointer"
                          >
                            <ThumbsUp size={12} className="text-amber-500" />
                            <span>Confirm Finding</span>
                          </button>

                          <button
                            type="button"
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
                            type="button"
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
                            <span className="p-1 px-2 bg-orange-500 rounded text-white font-mono font-bold text-[10px] tracking-wider flex items-center gap-1.5">
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
                          <div className="p-2.5 bg-emerald-950 text-white rounded flex items-center gap-2 text-xs font-mono font-bold shadow-sm">
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
                          <label
                            htmlFor="finding-title"
                            className="block font-mono font-bold text-zinc-600 uppercase tracking-wide text-[9.5px]"
                          >
                            Consolidated Problem Title (Editable)
                          </label>
                          <input 
                            id="finding-title"
                            type="text" 
                            value={activeFinding.title}
                            onChange={(e) => handleFieldChange('title', e.target.value)}
                            className="w-full p-2.5 bg-white border border-[#EAE6DF] rounded text-xs text-zinc-955 font-semibold focus:ring-1 focus:ring-emerald-950 focus:outline-none"
                          />
                        </div>

                        {/* 2. Structured Failure Problem Description */}
                        <div className="space-y-1.5 text-xs">
                          <label
                            htmlFor="finding-description"
                            className="block font-mono font-bold text-zinc-600 uppercase tracking-wide text-[9.5px]"
                          >
                            1. Failure Problem Description (Observed code/behaviors)
                          </label>
                          <textarea 
                            id="finding-description"
                            rows={3}
                            value={activeFinding.description}
                            onChange={(e) => handleFieldChange('description', e.target.value)}
                            className="w-full p-2.5 bg-white border border-[#EAE6DF] rounded text-xs text-zinc-800 leading-relaxed font-sans focus:ring-1 focus:ring-emerald-950 focus:outline-none"
                          />
                        </div>

                        {/* 3. Expected Behavior */}
                        <div className="space-y-1.5 text-xs">
                          <label
                            htmlFor="finding-expected-behavior"
                            className="block font-mono font-bold text-zinc-600 uppercase tracking-wide text-[9.5px]"
                          >
                            2. Expected Secure Behavior (Perspectives of maintainers)
                          </label>
                          <textarea 
                            id="finding-expected-behavior"
                            rows={3}
                            value={synthesisField(activeFinding.expectedBehavior)}
                            placeholder="Expected secure behavior from runtime synthesis (edit to enrich before publish)"
                            onChange={(e) => handleFieldChange('expectedBehavior', e.target.value)}
                            className="w-full p-2.5 bg-white border border-[#EAE6DF] rounded text-xs text-zinc-800 leading-relaxed font-sans focus:ring-1 focus:ring-emerald-950 focus:outline-none"
                          />
                        </div>

                        {/* 4. Suggested Fix */}
                        <div className="space-y-1.5 text-xs">
                          <label
                            htmlFor="finding-recommendation"
                            className="block font-mono font-bold text-zinc-600 uppercase tracking-wide text-[9.5px]"
                          >
                            3. Suggested Refactoring Fix Strategies
                          </label>
                          <textarea 
                            id="finding-recommendation"
                            rows={3}
                            value={activeFinding.recommendation}
                            onChange={(e) => handleFieldChange('recommendation', e.target.value)}
                            className="w-full p-2.5 bg-white border border-[#EAE6DF] rounded text-xs text-zinc-800 leading-relaxed font-mono text-[11px] focus:ring-1 focus:ring-emerald-950 focus:outline-none"
                          />
                        </div>

                        {/* 5. Success Criteria */}
                        <div className="space-y-1.5 text-xs">
                          <label
                            htmlFor="finding-success-criteria"
                            className="block font-mono font-bold text-zinc-600 uppercase tracking-wide text-[9.5px]"
                          >
                            4. Success Conditions for Closure (Testable test cases)
                          </label>
                          <textarea 
                            id="finding-success-criteria"
                            rows={3}
                            value={synthesisField(activeFinding.successCriteria)}
                            placeholder="Testable success criteria from runtime (edit before publish)"
                            onChange={(e) => handleFieldChange('successCriteria', e.target.value)}
                            className="w-full p-2.5 bg-white border border-[#EAE6DF] rounded text-xs text-zinc-800 leading-relaxed font-sans focus:ring-1 focus:ring-emerald-950 focus:outline-none"
                          />
                        </div>

                        {/* 6. Why It Matters */}
                        <div className="space-y-1.5 text-xs">
                          <label
                            htmlFor="finding-why-it-matters"
                            className="block font-mono font-bold text-zinc-600 uppercase tracking-wide text-[9.5px]"
                          >
                            5. Why It Matters (DX or reliability impacts justification)
                          </label>
                          <textarea 
                            id="finding-why-it-matters"
                            rows={3}
                            value={synthesisField(activeFinding.whyItMatters)}
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
                          <label htmlFor="merge-target-id" className="sr-only">
                            Choose a duplicate finding to merge
                          </label>
                          <select
                            id="merge-target-id"
                            value={mergeTargetId}
                            onChange={(e) => setMergeTargetId(e.target.value)}
                            className="w-full min-w-0 p-2 border border-[#EAE6DF] rounded bg-white font-sans focus:outline-none focus:border-emerald-950 text-neutral-800"
                          >
                            <option value="">-- Choose overlapping duplicate finding to merge --</option>
                            {findings.map((f) =>
                              f.id !== activeFinding.id && !f.mergedIntoId ? (
                                <option key={f.id} value={f.id}>
                                  [{f.severity}] {f.title} ({f.filepath})
                                </option>
                              ) : null
                            )}
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
                          <label htmlFor="split-finding-title" className="sr-only">
                            Title for the split follow-up issue
                          </label>
                          <input
                            id="split-finding-title"
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
                    {runtimeCheckpoint?.phase?.replace(/_/g, ' ') ?? activeAudit?.status ?? selectedAudit.status}
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
                auditStatus={activeAudit?.status ?? selectedAudit.status}
                agentRuns={runtimeAgentRuns}
                events={runtimeSnapshot?.events ?? []}
                summary={runtimeSnapshot?.summary}
                runtimeModeLabel={runtimeModeLabel}
                onStartAudit={onStartAudit}
                onPause={onPauseAudit}
                onStopAll={onStopAllRuntime}
                onResume={onResumeAudit}
                showStopAll={showStopAll}
                isStartAuditPending={isStartAuditPending}
                isPausePending={isPausePending}
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
                    <span>Agent Instance: {safeText(selectedAgent.name, 'Agent')}</span>
                  </div>

                  <div className="bg-neutral-950 font-mono text-[11px] text-zinc-300 rounded-lg p-5 overflow-hidden shadow-inner border border-neutral-800 leading-relaxed max-h-48 overflow-y-auto">
                    <div className="space-y-1 selection:bg-zinc-700 select-text">
                      {selectedAgent.logs.map((log) => (
                        <p
                          key={log}
                          className={
                            log.includes('CRITICAL') || log.includes('HIGH')
                          ? 'text-rose-500 font-bold'
                          : log.includes('MEDIUM')
                                ? 'text-amber-500'
                                : 'text-zinc-300'
                          }
                        >
                          &gt; [{safeUppercase(selectedAgent.id)}] {log}
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
