'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { FolderGit2, Workflow } from 'lucide-react';

import type { AuditRun, Project } from '@/lib/premortem-os/types';
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
import { useWorkflowPhoenixSemanticGraph } from './use-workflow-phoenix-semantic-graph';
import { useWorkflowViewMode } from './use-workflow-view-mode';
import { WorkflowCanvasBoard, type WorkflowCanvasBoardHandle } from './workflow-canvas-board';
import { WORKFLOW_STEP_IDS, type WorkflowAuditSnapshot } from './workflow-canvas.types';
import { WorkflowCommandBar } from './workflow-command-bar';
import { WorkflowEdgeBanner } from './workflow-edge-banner';
import { WorkflowGraphPanel } from './workflow-graph-panel';
import { WorkflowStepWorkbench } from './workflow-step-workbench';
import { panelClassForMode } from './workflow-view-mode-toggle';

interface WorkflowCanvasViewProps {
  projects: Project[];
  projectsLoading?: boolean;
  audits: AuditRun[];
  providerConnected?: boolean;
  onTriggerScan: (projectId: string) => void;
  setActiveTab: (tab: string) => void;
}

const SIMULATION_STEP_IDS = [...WORKFLOW_STEP_IDS];
const SIMULATION_EDGE_IDS = [
  null,
  'edge-vcs-scan',
  'edge-scan-audit',
  'edge-audit-cluster',
  'edge-cluster-review',
  'edge-review-publish'
] as const;

export function WorkflowCanvasView({
  projects,
  projectsLoading = false,
  audits,
  providerConnected = false,
  onTriggerScan,
  setActiveTab
}: WorkflowCanvasViewProps) {
  const [selectedProjectId, setSelectedProjectId] = useState<string>('');
  const [activeNodeId, setActiveNodeId] = useState<string | null>('node-run-audit');
  const [activeEdgeId, setActiveEdgeId] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [selectedFindingIdForDetail, setSelectedFindingIdForDetail] = useState<string | null>(null);
  const [selectedGraphNodeId, setSelectedGraphNodeId] = useState<string | null>(null);
  const canvasRef = useRef<WorkflowCanvasBoardHandle>(null);

  const [isSimulating, setIsSimulating] = useState(false);
  const [simulationIndex, setSimulationIndex] = useState(-1);

  const { viewMode, setViewMode } = useWorkflowViewMode(activeNodeId, WORKFLOW_STEP_IDS);

  const showToast = useCallback((message: string) => {
    setToastMessage(message);
    setTimeout(() => setToastMessage(null), 3500);
  }, []);

  const registeredProjects = projects;
  const effectiveProjects = useMemo(
    () => mergeConsoleProjects(registeredProjects, audits),
    [registeredProjects, audits]
  );
  const hasRegisteredProjects = registeredProjects.length > 0;
  const hasEffectiveProjects = effectiveProjects.length > 0;
  const inferredProjectsOnly = !hasRegisteredProjects && hasEffectiveProjects;

  useEffect(() => {
    if (!hasEffectiveProjects) return;

    const defaultProjectId = pickDefaultWorkflowProjectId(effectiveProjects, audits);
    if (!defaultProjectId) return;

    if (!selectedProjectId || !effectiveProjects.some((project) => project.id === selectedProjectId)) {
      setSelectedProjectId(defaultProjectId);
    }
  }, [audits, effectiveProjects, hasEffectiveProjects, selectedProjectId]);

  const selectedProj =
    effectiveProjects.find((project) => project.id === selectedProjectId) ?? effectiveProjects[0];

  const matchingAudit = selectedProj
    ? pickLatestAuditForProject(audits, selectedProjectId || selectedProj.id)
    : undefined;

  const snapshotQuery = useQuery({
    queryKey: ['os', 'audit-snapshot', matchingAudit?.id],
    enabled: Boolean(matchingAudit?.id),
    staleTime: 60_000,
    queryFn: async () => {
      const response = await fetch(`/api/audits/${matchingAudit!.id}`);
      if (!response.ok) return null;
      const payload = (await response.json()) as {
        snapshot?: WorkflowAuditSnapshot;
        auditRun?: WorkflowAuditSnapshot;
      };
      return payload.snapshot ?? payload.auditRun ?? null;
    }
  });

  const auditSnapshot = snapshotQuery.data ?? null;
  const runtimeEventTypes = auditSnapshot?.events?.map((event) => event.eventType) ?? [];

  useEffect(() => {
    setSelectedGraphNodeId(null);
  }, [matchingAudit?.id, selectedProjectId]);

  const graphArtifactEnabled = Boolean(matchingAudit?.id);
  const { nodes: artifactNodes, edges: artifactEdges, loading: graphArtifactLoading } =
    useWorkflowGraphArtifact(matchingAudit?.id, { enabled: graphArtifactEnabled });

  const {
    nodes: semanticNodes,
    edges: semanticEdges,
    configured: phoenixConfigured,
    included: semanticIncluded,
    loading: semanticGraphLoading
  } = useWorkflowPhoenixSemanticGraph(matchingAudit?.id, { enabled: graphArtifactEnabled });

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    if (isSimulating) {
      if (simulationIndex < 0) {
        setSimulationIndex(0);
        setActiveNodeId('node-connect-vcs');
        setActiveEdgeId(null);
      } else if (simulationIndex >= 6) {
        setIsSimulating(false);
        setSimulationIndex(-1);
        setActiveNodeId('node-publish-gitlab');
        showToast('Pipeline step replay finished.');
      } else {
        timer = setTimeout(() => {
          const nextIndex = simulationIndex + 1;
          setSimulationIndex(nextIndex);
          if (nextIndex < 6) {
            setActiveNodeId(SIMULATION_STEP_IDS[nextIndex]!);
            setActiveEdgeId(SIMULATION_EDGE_IDS[nextIndex] ?? null);
          }
        }, 2200);
      }
    }
    return () => {
      if (timer) clearTimeout(timer);
    };
  }, [isSimulating, simulationIndex, showToast]);

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
      runtimeEventTypes,
      isSimulating,
      simulationIndex,
      providerConnected
    });
  }, [
    selectedProj,
    matchingAudit,
    auditSnapshot,
    runtimeEventTypes,
    isSimulating,
    simulationIndex,
    providerConnected
  ]);

  const graphDisplay = useMemo(() => {
    return buildWorkflowGraphDisplay({
      artifactNodes,
      artifactEdges,
      semanticNodes,
      semanticEdges
    });
  }, [artifactNodes, artifactEdges, semanticNodes, semanticEdges]);

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
      <div className="flex h-screen flex-1 flex-col overflow-hidden font-sans" id="workflow-canvas-hub">
        <div className="border-b border-[#EAE6DF] bg-white p-6">
          <h2 className="flex items-center gap-2 font-mono text-sm font-bold uppercase tracking-tight text-[#1E2522]">
            <Workflow size={14} className="text-emerald-900" aria-hidden />
            Open Audit Trace Canvas
          </h2>
          <p className="mt-1 text-[11px] text-[#717A75]">
            Register a repository and run an audit to bind live traces to the pipeline canvas.
          </p>
        </div>
        <div className="flex flex-1 items-center justify-center p-8">
          <OsEmptyState
            icon={FolderGit2}
            title="No repositories in this workspace yet"
            description="Connect GitLab under Integrations and Scope, register a project, then run a security scan. The canvas shows real audit traces only."
            action={
              <button
                type="button"
                onClick={() => setActiveTab('projects')}
                className="rounded bg-emerald-950 px-3 py-1.5 font-mono text-[10px] font-bold uppercase tracking-wider text-white hover:bg-emerald-900"
              >
                Open Projects
              </button>
            }
          />
        </div>
      </div>
    );
  }

  const { nodes, edges, boardNodes, boardEdges, findingsList } = canvasModel;

  const activeNode = nodes.find((node) => node.id === activeNodeId);
  const activeEdge = edges.find((edge) => edge.id === activeEdgeId);

  const boardEdgesWithActive = boardEdges.map((edge) => ({
    ...edge,
    active: activeEdgeId === edge.id
  }));

  const graphEmptyMessage = !matchingAudit
    ? phoenixConfigured
      ? 'Run an audit to populate the repository graph and Phoenix semantic trace spans.'
      : 'Run an audit to populate the repository knowledge graph (repo, CI, issues).'
    : graphArtifactLoading || semanticGraphLoading
      ? 'Loading repository and Phoenix semantic graphs for the selected audit…'
      : graphDisplay.fromArtifact
        ? graphDisplay.semanticIncluded
          ? undefined
          : phoenixConfigured
            ? 'Repository graph loaded. Phoenix semantic spans will appear on the next traced audit run.'
            : undefined
        : graphDisplay.semanticIncluded
          ? undefined
          : 'This audit has no repository graph artifact yet. Re-run the scan or open Audits for details.';

  return (
    <div className="flex h-screen flex-1 flex-col overflow-hidden font-sans" id="workflow-canvas-hub">
      <WorkflowCommandBar
        viewMode={viewMode}
        onViewModeChange={(mode) => setViewMode(mode, true)}
        isSimulating={isSimulating}
        onToggleSimulation={() => {
          if (isSimulating) {
            setIsSimulating(false);
            setSimulationIndex(-1);
          } else {
            setIsSimulating(true);
            setSimulationIndex(0);
            setActiveNodeId('node-connect-vcs');
            setActiveEdgeId(null);
          }
        }}
        onResetLayout={() => canvasRef.current?.resetLayout()}
        onResetCamera={() => canvasRef.current?.resetCamera()}
        projects={effectiveProjects}
        selectedProjectId={selectedProjectId}
        onProjectChange={setSelectedProjectId}
        selectedProject={selectedProj}
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

      <div className="flex min-h-0 flex-1 overflow-hidden">
        <div className={`border-r border-[#EAE6DF] ${panelClassForMode('left', viewMode)}`}>
          <WorkflowGraphPanel
            nodes={graphDisplay.nodes}
            edges={graphDisplay.edges}
            nodeCount={graphDisplay.nodes.length}
            edgeCount={graphDisplay.edges.length}
            layoutKey={viewMode}
            memoryUpdating={isSimulating || selectedProj.status === 'SCANNING'}
            selectedGraphNodeId={selectedGraphNodeId}
            auditSnapshot={auditSnapshot}
            auditRunId={matchingAudit?.id}
            emptyMessage={graphEmptyMessage}
            semanticIncluded={graphDisplay.semanticIncluded}
            phoenixConfigured={phoenixConfigured}
            onSelectGraphNode={setSelectedGraphNodeId}
            onNavigateTab={setActiveTab}
          />
        </div>

        <div className={`flex min-h-0 flex-col overflow-hidden ${panelClassForMode('right', viewMode)}`}>
          <div className="flex min-h-0 flex-[1.05] flex-col overflow-hidden bg-[#FAF8F5]">
            {isSimulating && (
              <div className="absolute left-1/2 top-4 z-30 flex -translate-x-1/2 items-center gap-2 rounded-full border border-amber-300 bg-amber-50 p-2 px-6 font-mono text-[10px] font-bold text-amber-950 shadow-md">
                <span className="h-2 w-2 motion-safe:animate-ping rounded-full bg-amber-600" />
                <span>
                  Step replay (not live data): {simulationIndex + 1} of 6 — &quot;
                  {nodes[simulationIndex]?.label || 'Active gateway'}&quot;
                </span>
              </div>
            )}

            <div className="relative min-h-0 flex-1 overflow-hidden p-4">
              <WorkflowCanvasBoard
                ref={canvasRef}
                nodes={boardNodes}
                edges={boardEdgesWithActive}
                activeNodeId={activeNodeId}
                activeEdgeId={activeEdgeId}
                onSelectNode={(id) => {
                  setActiveNodeId(id);
                  setActiveEdgeId(null);
                }}
                onSelectEdge={(id) => {
                  setActiveEdgeId(id);
                  setActiveNodeId(null);
                }}
                onClearSelection={() => {
                  setActiveNodeId(null);
                  setActiveEdgeId(null);
                }}
              />
            </div>

            {activeEdge && <WorkflowEdgeBanner edge={activeEdge} />}
          </div>

          <div className="flex min-h-0 flex-[0.95] flex-col overflow-hidden border-t border-[#EAE6DF]">
            <WorkflowStepWorkbench
              activeNode={activeNode}
              activeEdge={activeEdge}
              activeNodeId={activeNodeId}
              findingsList={findingsList}
              auditSnapshot={auditSnapshot}
              isSimulating={isSimulating}
              simulationIndex={simulationIndex}
              nodes={nodes}
              selectedFindingIdForDetail={selectedFindingIdForDetail}
              onSelectFinding={setSelectedFindingIdForDetail}
              onClearSelection={() => {
                setActiveNodeId(null);
                setActiveEdgeId(null);
              }}
              onSelectStep={(stepId) => {
                setActiveNodeId(stepId);
                setActiveEdgeId(null);
              }}
              onNavigateTab={setActiveTab}
            />
          </div>
        </div>
      </div>

      <OsToast message={toastMessage ?? ''} />
    </div>
  );
}
