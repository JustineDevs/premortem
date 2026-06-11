'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';

import type { AuditRun, Project } from '@/lib/premortem-os/types';

import { buildWorkflowCanvasModel } from './build-workflow-canvas-model';
import { buildWorkflowGraphDisplay } from './build-workflow-graph-display';
import { OsToast } from './os-toast';
import { useWorkflowGraphArtifact } from './use-workflow-graph-artifact';
import { useWorkflowViewMode } from './use-workflow-view-mode';
import { WorkflowCanvasBoard, type WorkflowCanvasBoardHandle } from './workflow-canvas-board';
import {
  WORKFLOW_STEP_IDS,
  type WorkflowAuditSnapshot
} from './workflow-canvas.types';
import { WorkflowCommandBar } from './workflow-command-bar';
import { WorkflowEdgeBanner } from './workflow-edge-banner';
import { WorkflowGraphPanel } from './workflow-graph-panel';
import { WorkflowStepWorkbench } from './workflow-step-workbench';
import { panelClassForMode } from './workflow-view-mode-toggle';

interface WorkflowCanvasViewProps {
  projects: Project[];
  audits: AuditRun[];
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
  audits,
  onTriggerScan,
  setActiveTab
}: WorkflowCanvasViewProps) {
  const [selectedProjectId, setSelectedProjectId] = useState<string>('');
  const [activeNodeId, setActiveNodeId] = useState<string | null>('node-run-audit');
  const [activeEdgeId, setActiveEdgeId] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [selectedFindingIdForDetail, setSelectedFindingIdForDetail] = useState<string | null>(null);
  const canvasRef = useRef<WorkflowCanvasBoardHandle>(null);

  const [isSimulating, setIsSimulating] = useState(false);
  const [simulationIndex, setSimulationIndex] = useState(-1);

  const { viewMode, setViewMode } = useWorkflowViewMode(activeNodeId, WORKFLOW_STEP_IDS);

  const showToast = useCallback((message: string) => {
    setToastMessage(message);
    setTimeout(() => setToastMessage(null), 3500);
  }, []);

  useEffect(() => {
    if (projects.length > 0 && !selectedProjectId) {
      setSelectedProjectId(projects[0].id);
    }
  }, [projects, selectedProjectId]);

  const matchingAudit = audits.find((audit) => audit.projectId === selectedProjectId);

  const snapshotQuery = useQuery({
    queryKey: ['os', 'audit-snapshot', matchingAudit?.id],
    enabled: Boolean(matchingAudit?.id),
    staleTime: 60_000,
    queryFn: async () => {
      const response = await fetch(`/api/audits/${matchingAudit!.id}`);
      if (!response.ok) return null;
      const payload = (await response.json()) as { snapshot?: WorkflowAuditSnapshot };
      return payload.snapshot ?? null;
    }
  });

  const auditSnapshot = snapshotQuery.data ?? null;
  const runtimeEventTypes = auditSnapshot?.events?.map((event) => event.eventType) ?? [];

  const graphArtifactEnabled = Boolean(matchingAudit?.graphSnapshot?.nodeCount);
  const { nodes: artifactNodes, edges: artifactEdges } = useWorkflowGraphArtifact(
    matchingAudit?.id,
    { enabled: graphArtifactEnabled }
  );

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
        showToast('Audit pipeline trace simulation completed.');
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

  const selectedProj = projects.find((project) => project.id === selectedProjectId) || projects[0];

  const canvasModel = useMemo(() => {
    if (!selectedProj) return null;
    return buildWorkflowCanvasModel({
      selectedProj,
      matchingAudit,
      auditSnapshot,
      runtimeEventTypes,
      isSimulating,
      simulationIndex
    });
  }, [
    selectedProj,
    matchingAudit,
    auditSnapshot,
    runtimeEventTypes,
    isSimulating,
    simulationIndex
  ]);

  const graphDisplay = useMemo(() => {
    return buildWorkflowGraphDisplay({
      artifactNodes,
      artifactEdges
    });
  }, [artifactNodes, artifactEdges]);

  if (!selectedProj || !canvasModel) {
    return (
      <div className="flex-1 p-8 text-center font-mono text-xs italic text-zinc-500">
        Loading workspace projects list...
      </div>
    );
  }

  const { nodes, edges, boardNodes, boardEdges, findingsList, graphNodeCount, graphEdgeCount } =
    canvasModel;

  const activeNode = nodes.find((node) => node.id === activeNodeId);
  const activeEdge = edges.find((edge) => edge.id === activeEdgeId);

  const boardEdgesWithActive = boardEdges.map((edge) => ({
    ...edge,
    active: activeEdgeId === edge.id
  }));

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
        projects={projects}
        selectedProjectId={selectedProjectId}
        onProjectChange={setSelectedProjectId}
        selectedProject={selectedProj}
        onExecuteStream={() => {
          onTriggerScan(selectedProj.id);
          showToast(`Executing Premortem pipeline for "${selectedProj.name}"…`);
        }}
      />

      <div className="flex min-h-0 flex-1 overflow-hidden">
        <div className={`border-r border-[#EAE6DF] ${panelClassForMode('left', viewMode)}`}>
          <WorkflowGraphPanel
            nodes={graphDisplay.nodes}
            edges={graphDisplay.edges}
            nodeCount={graphNodeCount}
            edgeCount={graphEdgeCount}
            memoryUpdating={isSimulating || selectedProj.status === 'SCANNING'}
            activeNodeId={activeNodeId}
            onSelectNode={(id) => {
              setActiveNodeId(id);
              setActiveEdgeId(null);
            }}
          />
        </div>

        <div className={`flex min-h-0 flex-col overflow-hidden ${panelClassForMode('right', viewMode)}`}>
          <div className="flex min-h-0 flex-[1.05] flex-col overflow-hidden bg-[#FAF8F5]">
            {isSimulating && (
              <div className="absolute left-1/2 top-4 z-30 flex -translate-x-1/2 items-center gap-2 rounded-full border border-amber-300 bg-amber-50 p-2 px-6 font-mono text-[10px] font-bold text-amber-950 shadow-md">
                <span className="h-2 w-2 motion-safe:animate-ping rounded-full bg-amber-600" />
                <span>
                  Trace simulation: step {simulationIndex + 1} of 6 — &quot;
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
