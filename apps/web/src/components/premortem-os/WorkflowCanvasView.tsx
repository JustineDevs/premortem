'use client';

import dynamic from 'next/dynamic';
import React, { forwardRef, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { FolderGit2, Workflow } from 'lucide-react';

import type { AuditRun, Project } from '@/lib/premortem-os/types';
import type { OsQueryScope } from '@/hooks/use-os-console-data';
import {
  mergeConsoleProjects,
  pickDefaultWorkflowProjectId,
  pickLatestAuditForProject
} from '@/lib/premortem-os/merge-console-projects';

import { buildWorkflowCanvasModel } from './build-workflow-canvas-model';
import { buildWorkflowGraphDisplay } from './build-workflow-graph-display';
import { OsEmptyState } from './os-empty-state';
import { OsSkeleton } from './os-skeleton';
import { OsToast } from './os-toast';
import { useWorkflowGraphArtifact } from './use-workflow-graph-artifact';
import { useAuditRealtime } from './use-audit-realtime';
import { useWorkflowPhoenixSemanticGraph } from './use-workflow-phoenix-semantic-graph';
import { useWorkflowViewMode } from './use-workflow-view-mode';
import { buildFindingPathFilterPredicate } from './workflow-topology';
import type {
  WorkflowCanvasBoardHandle,
  WorkflowCanvasBoardProps
} from './workflow-canvas-board';
import { WORKFLOW_STEP_IDS } from './workflow-canvas.types';
import { WorkflowCommandBar } from './workflow-command-bar';
import { WorkflowStepWorkbench } from './workflow-step-workbench';
import { panelClassForMode } from './workflow-view-mode-toggle';

interface WorkflowCanvasViewProps {
  queryScope?: OsQueryScope;
  projects: Project[];
  projectsLoading?: boolean;
  audits: AuditRun[];
  providerConnected?: boolean;
  onTriggerScan: (projectId: string) => void;
  setActiveTab: (tab: string) => void;
}

const EMPTY_PROJECTS: Project[] = [];
const EMPTY_AUDITS: AuditRun[] = [];
const EMPTY_AGENT_RUNS: NonNullable<WorkflowCanvasBoardProps['agentRuns']> = [];

const WorkflowCanvasBoardClient = dynamic(
  () => import('./workflow-canvas-board').then((module) => module.WorkflowCanvasBoard),
  {
    ssr: false,
    loading: () => <OsSkeleton className="min-h-[520px] w-full rounded-lg" />
  }
);

const WorkflowCanvasBoard = forwardRef<WorkflowCanvasBoardHandle, WorkflowCanvasBoardProps>(
  function WorkflowCanvasBoard(props, ref) {
    return <WorkflowCanvasBoardClient {...props} ref={ref} />;
  }
);

const WorkflowGraphPanel = dynamic(
  () => import('./workflow-graph-panel').then((module) => module.WorkflowGraphPanel),
  {
    ssr: false,
    loading: () => <OsSkeleton className="min-h-[420px] w-full rounded-lg" />
  }
);

export function WorkflowCanvasView({
  queryScope = null,
  projects,
  projectsLoading = false,
  audits,
  providerConnected = false,
  onTriggerScan,
  setActiveTab
}: WorkflowCanvasViewProps) {
  const safeProjects = Array.isArray(projects) ? projects : EMPTY_PROJECTS;
  const safeAudits = Array.isArray(audits) ? audits : EMPTY_AUDITS;
  const [selectedProjectId, setSelectedProjectId] = useState<string>('');
  const [selection, setSelection] = useState<{ nodeId: string | null; edgeId: string | null }>({
    nodeId: null,
    edgeId: null
  });
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [selectedFindingIdForDetail, setSelectedFindingIdForDetail] = useState<string | null>(null);
  const [selectedFindingPathFilter, setSelectedFindingPathFilter] = useState<string | null>(null);
  const [selectedAgentRunId, setSelectedAgentRunId] = useState<string | null>(null);
  const [diffMode, setDiffMode] = useState(false);
  const [baselineAuditId, setBaselineAuditId] = useState<string>('');
  const [graphSelection, setGraphSelection] = useState<{ scope: string; nodeId: string | null }>({
    scope: '',
    nodeId: null
  });
  const [isInspectionCollapsed, setIsInspectionCollapsed] = useState(false);
  const canvasRef = useRef<WorkflowCanvasBoardHandle>(null);
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const activeNodeId = selection.nodeId;
  const activeEdgeId = selection.edgeId;

  const { viewMode, setViewMode } = useWorkflowViewMode(activeNodeId, WORKFLOW_STEP_IDS);
  const isSplitMode = viewMode === 'split';
  const isWorkbenchMode = viewMode === 'workbench';
  const inspectionCollapsed = isSplitMode ? isInspectionCollapsed : false;

  const showToast = useCallback((message: string) => {
    setToastMessage(message);
    if (toastTimerRef.current) {
      clearTimeout(toastTimerRef.current);
    }
    toastTimerRef.current = setTimeout(() => setToastMessage(null), 3500);
  }, []);

  useEffect(
    () => () => {
      if (toastTimerRef.current) {
        clearTimeout(toastTimerRef.current);
      }
    },
    []
  );

  const registeredProjects = safeProjects;
  const effectiveProjects = useMemo(
    () => mergeConsoleProjects(registeredProjects, safeAudits),
    [registeredProjects, safeAudits]
  );
  const hasRegisteredProjects = registeredProjects.length > 0;
  const hasEffectiveProjects = effectiveProjects.length > 0;
  const inferredProjectsOnly = !hasRegisteredProjects && hasEffectiveProjects;

  const defaultProjectId = useMemo(() => {
    if (!hasEffectiveProjects) return '';
    return pickDefaultWorkflowProjectId(effectiveProjects, safeAudits) ?? effectiveProjects[0]?.id ?? '';
  }, [effectiveProjects, hasEffectiveProjects, safeAudits]);
  const effectiveSelectedProjectId =
    selectedProjectId && effectiveProjects.some((project) => project.id === selectedProjectId)
      ? selectedProjectId
      : defaultProjectId;
  const selectedProj =
    effectiveProjects.find((project) => project.id === effectiveSelectedProjectId) ??
    effectiveProjects[0];
  const selectedProjIdForCanvas = selectedProj?.id ?? effectiveSelectedProjectId;

  const matchingAudit = selectedProj
    ? pickLatestAuditForProject(safeAudits, selectedProjIdForCanvas)
    : undefined;
  const matchingAuditId = matchingAudit?.id ?? null;
  const graphSelectionScope = `${effectiveSelectedProjectId || selectedProj?.id || 'none'}:${matchingAudit?.id ?? 'none'}`;
  const selectedGraphNodeId =
    graphSelection.scope === graphSelectionScope ? graphSelection.nodeId : null;

  useEffect(() => {
    setSelection((current) =>
      current.nodeId || current.edgeId ? { nodeId: null, edgeId: null } : current
    );
    setSelectedFindingIdForDetail((current) => (current ? null : current));
    setSelectedFindingPathFilter((current) => (current ? null : current));
    setSelectedAgentRunId((current) => (current ? null : current));
    setGraphSelection((current) =>
      current.scope || current.nodeId ? { scope: '', nodeId: null } : current
    );
  }, [effectiveSelectedProjectId, matchingAudit?.id]);

  const { snapshot: auditSnapshot, connectionState: realtimeConnectionState } = useAuditRealtime(
    matchingAuditId ?? undefined,
    {
      enabled: Boolean(matchingAuditId),
      queryScope
    }
  );
  const runtimeEventTypes = useMemo(
    () => auditSnapshot?.events?.map((event: { eventType: string }) => event.eventType) ?? [],
    [auditSnapshot]
  );

  const graphArtifactEnabled = Boolean(matchingAuditId);
  const { nodes: artifactNodes, edges: artifactEdges, loading: graphArtifactLoading } =
    useWorkflowGraphArtifact(matchingAuditId ?? undefined, { enabled: graphArtifactEnabled, queryScope });
  const { nodes: baselineArtifactNodes, edges: baselineArtifactEdges, loading: baselineGraphLoading } =
    useWorkflowGraphArtifact(
      diffMode ? baselineAuditId || undefined : undefined,
      {
        enabled: diffMode && Boolean(baselineAuditId),
        queryScope
      }
    );

  const {
    nodes: semanticNodes,
    edges: semanticEdges,
    configured: phoenixConfigured,
    included: semanticIncluded,
    loading: semanticGraphLoading
  } = useWorkflowPhoenixSemanticGraph(matchingAudit?.id, {
    enabled: graphArtifactEnabled,
    queryScope
  });


  const baselineAuditOptions = useMemo(
    () => {
      if (!selectedProjIdForCanvas) {
        return [];
      }

      return safeAudits
        .filter((audit) => audit.projectId === selectedProjIdForCanvas && audit.id !== matchingAuditId)
        .sort((a, b) => b.date.localeCompare(a.date))
        .slice(0, 8)
        .map((audit) => ({
          id: audit.id,
          label: `${audit.date.slice(0, 10)} · ${audit.status.toLowerCase()} · ${audit.score}/100`
        }));
    },
    [matchingAuditId, safeAudits, selectedProjIdForCanvas]
  );

  useEffect(() => {
    if (!baselineAuditOptions.length) {
      setBaselineAuditId('');
      return;
    }
    setBaselineAuditId((current) => {
      if (current && baselineAuditOptions.some((option) => option.id === current)) {
        return current;
      }
      return baselineAuditOptions[0]?.id ?? '';
    });
  }, [baselineAuditOptions]);

  const canvasModel = useMemo(() => {
    if (!selectedProj) {
      return {
        nodes: [],
        edges: [],
        boardNodes: [],
        boardEdges: [],
        findingsList: [],
        graphNodeCount: 0,
        graphEdgeCount: 0
      };
    }

    return buildWorkflowCanvasModel({
      selectedProj,
      matchingAudit,
      auditSnapshot,
      auditSummary: auditSnapshot?.summary ?? null,
      runtimeEventTypes,
      providerConnected
    });
  }, [
    selectedProj,
    matchingAudit,
    auditSnapshot,
    runtimeEventTypes,
    providerConnected
  ]);

  const { nodes, edges, boardNodes, boardEdges, findingsList } = canvasModel;
  const filteredFindingsList = useMemo(
    () =>
      selectedFindingPathFilter
        ? findingsList.filter(buildFindingPathFilterPredicate(selectedFindingPathFilter))
        : findingsList,
    [findingsList, selectedFindingPathFilter]
  );
  const selectedFindingById = useMemo(
    () => (selectedFindingIdForDetail ? findingsList.find((finding) => finding.id === selectedFindingIdForDetail) ?? null : null),
    [findingsList, selectedFindingIdForDetail]
  );
  const activeNode = useMemo(
    () => nodes.find((node) => node.id === activeNodeId),
    [activeNodeId, nodes]
  );
  const activeEdge = useMemo(
    () => edges.find((edge) => edge.id === activeEdgeId),
    [activeEdgeId, edges]
  );

  const boardEdgesWithActive = useMemo(
    () =>
      boardEdges.map((edge) => ({
        ...edge,
        active: activeEdgeId === edge.id
      })),
    [activeEdgeId, boardEdges]
  );

  const graphDisplay = useMemo(() => {
    return buildWorkflowGraphDisplay({
      artifactNodes,
      artifactEdges,
      semanticNodes,
      semanticEdges
    });
  }, [artifactNodes, artifactEdges, semanticNodes, semanticEdges]);

  const graphDisplayWithDiff = useMemo(
    () => ({
      nodes: graphDisplay.nodes,
      edges: graphDisplay.edges,
      baselineNodes: baselineArtifactNodes,
      baselineEdges: baselineArtifactEdges
    }),
    [baselineArtifactEdges, baselineArtifactNodes, graphDisplay.edges, graphDisplay.nodes]
  );

  if (projectsLoading && !hasEffectiveProjects) {
    return (
      <div className="flex flex-1 flex-col gap-4 p-8">
        <OsSkeleton className="h-14 w-full max-w-3xl" />
        <OsSkeleton className="min-h-[420px] flex-1 w-full" />
        <p className="font-mono text-[10px] uppercase tracking-wider text-[#8A958F]">
          Loading workspace projects…
        </p>
      </div>
    );
  }

  if (!hasEffectiveProjects || !selectedProj) {
    return (
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden font-sans" id="workflow-canvas-hub">
        <div className="border-b border-[#EAE6DF] bg-white p-6">
          <h2 className="flex items-center gap-2 font-mono text-sm font-bold uppercase tracking-tight text-[#1E2522]">
            <Workflow size={14} className="text-emerald-900" aria-hidden />
            Open Audit Trace Canvas
          </h2>
          <p className="mt-1 text-[11px] text-[#717A75]">
            {providerConnected
              ? 'GitLab is connected, but no projects are enabled yet. Open Projects Inventory to enable one and bind live traces to the pipeline canvas.'
              : 'Connect GitLab and register a repository to bind live traces to the pipeline canvas.'}
          </p>
        </div>
        <div className="flex flex-1 items-center justify-center p-8">
          <OsEmptyState
            icon={FolderGit2}
            title={providerConnected ? 'No enabled projects yet' : 'No repositories in this workspace yet'}
            description={
              providerConnected
                ? 'GitLab is connected, but no repository has been enabled in Projects yet. Open Projects Inventory, enable one repository, then return to the canvas.'
                : 'Connect GitLab under Integrations and Scope, register a project, then run a security scan. The canvas shows real audit traces only.'
            }
            action={
              <button
                type="button"
                onClick={() => setActiveTab('projects')}
                className="rounded bg-emerald-950 px-3 py-1.5 font-mono text-[10px] font-bold uppercase tracking-wider text-white hover:bg-emerald-900"
              >
                {providerConnected ? 'Open Projects Inventory' : 'Open Projects'}
              </button>
            }
          />
        </div>
      </div>
    );
  }

  const graphEmptyMessage = !matchingAudit
    ? phoenixConfigured
      ? 'Run an audit to populate the graph and Phoenix semantic trace spans.'
      : 'Run an audit to populate the graph (repo, CI, issues).'
    : graphArtifactLoading || semanticGraphLoading || (diffMode && baselineGraphLoading)
      ? 'Loading graph and Phoenix semantic spans for the selected audit…'
      : graphDisplay.fromArtifact
        ? graphDisplay.semanticIncluded
          ? undefined
          : phoenixConfigured
            ? 'Graph loaded. Phoenix semantic spans will appear on the next traced audit run.'
            : undefined
        : graphDisplay.semanticIncluded
          ? undefined
          : 'This audit has no graph artifact yet. Re-run the scan or open Audits for details.';

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden font-sans" id="workflow-canvas-hub">
      <WorkflowCommandBar
        viewMode={viewMode}
        onViewModeChange={(mode) => setViewMode(mode, true)}
        realtimeConnectionState={realtimeConnectionState}
        currentRunStatus={auditSnapshot?.runStatus ?? matchingAudit?.status ?? 'idle'}
        diffMode={diffMode}
        onToggleDiffMode={() => setDiffMode((current) => !current)}
        baselineAuditId={baselineAuditId}
        baselineAuditOptions={baselineAuditOptions}
        onBaselineAuditChange={setBaselineAuditId}
        onResetLayout={() => canvasRef.current?.resetLayout()}
        onResetCamera={() => canvasRef.current?.resetCamera()}
        projects={effectiveProjects}
        selectedProjectId={effectiveSelectedProjectId}
        onProjectChange={setSelectedProjectId}
        selectedProject={selectedProj}
        selectedEdge={activeEdge}
        hasProjects={hasRegisteredProjects}
        onExecuteStream={() => {
          if (!hasRegisteredProjects) {
            setActiveTab('projects');
            showToast(
              inferredProjectsOnly
                ? 'Re-link this repository under Projects to run new scans.'
                : 'Register a repository under Projects before running a scan.'
            );
            return;
          }
          onTriggerScan(selectedProj.id);
          showToast(`Executing Premortem pipeline for "${selectedProj.name}"…`);
        }}
      />

      {inferredProjectsOnly ? (
        <div className="border-b border-amber-200 bg-amber-50 px-4 py-2 font-mono text-[10px] text-amber-950">
          Audit history found, but no registered repositories in Projects. Showing the latest audit
          trace. Open Projects to re-link GitLab and run new scans.
        </div>
      ) : null}

      <div className="relative flex min-h-0 flex-1 overflow-hidden">
        <div
          className={`border-r border-[#EAE6DF] ${panelClassForMode(
            'left',
            viewMode
          )}`}
        >
          <WorkflowGraphPanel
            nodes={graphDisplayWithDiff.nodes}
            edges={graphDisplayWithDiff.edges}
            nodeCount={graphDisplayWithDiff.nodes.length}
            edgeCount={graphDisplayWithDiff.edges.length}
            layoutKey={viewMode}
            memoryUpdating={selectedProj.status === 'SCANNING' || realtimeConnectionState === 'connecting'}
            selectedGraphNodeId={selectedGraphNodeId}
            auditSnapshot={auditSnapshot}
            auditRunId={matchingAudit?.id}
            emptyMessage={graphEmptyMessage}
            semanticIncluded={graphDisplay.semanticIncluded}
            phoenixConfigured={phoenixConfigured}
            selectedFinding={selectedFindingById}
            diffMode={diffMode}
            baselineNodes={graphDisplayWithDiff.baselineNodes}
            baselineEdges={graphDisplayWithDiff.baselineEdges}
            onSelectGraphNode={(nodeId) => {
              setGraphSelection({ scope: graphSelectionScope, nodeId });
            }}
            onNavigateTab={setActiveTab}
            onSelectFindingPath={(path) => {
              setSelectedFindingPathFilter(path);
              setSelectedFindingIdForDetail(null);
            }}
            onRunTargetedAudit={(path, node) => {
              if (!path) {
                showToast('No file path is available for this node.');
                return;
              }
              onTriggerScan(selectedProj.id);
              showToast(`Triggered a targeted audit for ${path} from ${node?.label ?? 'canvas node'}.`);
            }}
          />
        </div>

        <div className={`flex min-h-0 flex-col overflow-hidden ${panelClassForMode('right', viewMode)}`}>
          {!isWorkbenchMode ? (
            <div className="flex min-h-0 flex-[1.1] flex-col overflow-hidden bg-[#FAF8F5]">
              <div className="relative min-h-0 flex-1 overflow-hidden p-4">
                <WorkflowCanvasBoard
                  ref={canvasRef}
                  nodes={boardNodes}
                  edges={boardEdgesWithActive}
                  activeNodeId={activeNodeId}
                  activeEdgeId={activeEdgeId}
                  agentRuns={auditSnapshot?.agentRuns ?? matchingAudit?.agentRuns ?? EMPTY_AGENT_RUNS}
                  selectedAgentRunId={selectedAgentRunId}
                  onSelectNode={(id) => {
                    setSelection({ nodeId: id, edgeId: null });
                  }}
                  onSelectEdge={(id) => {
                    setSelection({ nodeId: null, edgeId: id });
                  }}
                  onSelectAgentRun={setSelectedAgentRunId}
                  onClearSelection={() => {
                    setSelection({ nodeId: null, edgeId: null });
                    setSelectedAgentRunId(null);
                  }}
                />
              </div>
            </div>
          ) : null}

          <div
            className={`flex min-h-0 flex-col overflow-hidden border-t border-[#EAE6DF] ${
              isWorkbenchMode
                ? 'flex-1'
                : isSplitMode && isInspectionCollapsed
                  ? 'flex-none'
                  : 'flex-[1.05]'
            }`}
          >
            <WorkflowStepWorkbench
              activeNode={activeNode}
              activeEdge={activeEdge}
              activeNodeId={activeNodeId}
              findingsList={filteredFindingsList}
              auditSnapshot={auditSnapshot}
              selectedFindingIdForDetail={selectedFindingIdForDetail}
              selectedAgentRunId={selectedAgentRunId}
              findingPathFilter={selectedFindingPathFilter}
              onSelectFinding={(findingId) => {
                setSelectedFindingIdForDetail(findingId);
                if (!findingId) {
                  setSelectedFindingPathFilter(null);
                  return;
                }
                const matchedFinding = findingsList.find((finding) => finding.id === findingId);
                setSelectedFindingPathFilter(matchedFinding?.filepath ?? null);
              }}
              onClearSelection={() => {
                setSelection({ nodeId: null, edgeId: null });
                setSelectedAgentRunId(null);
              }}
              onSelectStep={(stepId) => {
                setSelection({ nodeId: stepId, edgeId: null });
                setSelectedAgentRunId(null);
              }}
              onNavigateTab={setActiveTab}
              canCollapse={isSplitMode}
              isCollapsed={inspectionCollapsed}
              onToggleCollapse={() => setIsInspectionCollapsed((value) => !value)}
            />
          </div>
        </div>
      </div>

      <OsToast message={toastMessage ?? ''} />
    </div>
  );
}
