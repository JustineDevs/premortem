import React, { useState, useEffect } from 'react';
import { Project, AuditRun, Finding, SeverityType } from '@/lib/premortem-os/types';
import { 
  GitBranch, 
  Workflow, 
  Layers, 
  Settings, 
  Play, 
  Clock, 
  Activity, 
  FileCode, 
  Sparkles, 
  ThumbsUp, 
  CloudLightning, 
  CheckCircle2, 
  AlertTriangle, 
  X, 
  ExternalLink,
  ChevronRight,
  Database,
  ArrowRight,
  Info
} from 'lucide-react';
import { ProviderIcon } from './ProviderIcon';

interface WorkflowCanvasViewProps {
  projects: Project[];
  audits: AuditRun[];
  onTriggerScan: (projectId: string) => void;
  setActiveTab: (tab: string) => void;
}

// Defining our types for Canvas Nodes and Edges
interface CanvasNode {
  id: string;
  label: string;
  type: 'input' | 'execution' | 'synthesis' | 'review' | 'publish';
  description: string;
  status: 'queued' | 'running' | 'completed' | 'partial' | 'failed' | 'reviewable' | 'published';
  targetLinkTab: string;
  metadata: {
    title: string;
    duration?: string;
    timestamp?: string;
    inputs: string[];
    outputs: string[];
    logs: string[];
    systemNote?: string;
    promptVersion?: string;
    agentConfig?: string;
    linkedFindingIds?: string[];
  };
  x: number; // visual grid coordinate
  y: number; // visual grid coordinate
}

interface CanvasEdge {
  id: string;
  from: string;
  to: string;
  label: string;
  transformationDetail: string;
}

export function WorkflowCanvasView({ projects, audits, onTriggerScan, setActiveTab }: WorkflowCanvasViewProps) {
  const [selectedProjectId, setSelectedProjectId] = useState<string>('');
  const [activeNodeId, setActiveNodeId] = useState<string | null>('node-run-audit');
  const [activeEdgeId, setActiveEdgeId] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [selectedFindingIdForDetail, setSelectedFindingIdForDetail] = useState<string | null>(null);

  // Trace Simulation Player States
  const [isSimulating, setIsSimulating] = useState<boolean>(false);
  const [simulationIndex, setSimulationIndex] = useState<number>(-1);

  // Initialize selected project
  useEffect(() => {
    if (projects.length > 0 && !selectedProjectId) {
      setSelectedProjectId(projects[0].id);
    }
  }, [projects, selectedProjectId]);

  // Trace simulation loop effector
  useEffect(() => {
    let timer: any;
    if (isSimulating) {
      if (simulationIndex < 0) {
        setSimulationIndex(0);
        setActiveNodeId('node-connect-vcs');
        setActiveEdgeId(null);
      } else if (simulationIndex >= 6) {
        setIsSimulating(false);
        setSimulationIndex(-1);
        setActiveNodeId('node-publish-gitlab');
        showToast('Audit Pipeline Trace Simulation completed successfully!');
      } else {
        timer = setTimeout(() => {
          const nextIndex = simulationIndex + 1;
          setSimulationIndex(nextIndex);
          
          const stepIds = [
            'node-connect-vcs', 
            'node-scan-repo', 
            'node-run-audit', 
            'node-cluster-risks', 
            'node-review-approval', 
            'node-publish-gitlab'
          ];
          
          if (nextIndex < 6) {
            setActiveNodeId(stepIds[nextIndex]);
            const edgeIds = [
              null,
              'edge-vcs-scan',
              'edge-scan-audit',
              'edge-audit-cluster',
              'edge-cluster-review',
              'edge-review-publish'
            ];
            setActiveEdgeId(edgeIds[nextIndex]);
          }
        }, 2200);
      }
    }
    return () => clearTimeout(timer);
  }, [isSimulating, simulationIndex]);

  const selectedProj = projects.find(p => p.id === selectedProjectId) || projects[0];
  const matchingAudit = audits.find(a => a.projectId === selectedProjectId);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  if (!selectedProj) {
    return (
      <div className="flex-1 p-8 text-center text-xs text-zinc-500 font-mono italic">
        Loading workspace projects list...
      </div>
    );
  }

  // Derive node states mechanically from Project and Audit status to stay authentic to underlying models
  const totalFindingsCount = matchingAudit?.findings?.length || 0;
  const criticalFindings = matchingAudit?.findings?.filter(f => f.severity === 'CRITICAL' || f.severity === 'HIGH') || [];
  const resolvedFindings = matchingAudit?.findings?.filter(f => f.status === 'RESOLVED') || [];
  const publishedFindings = matchingAudit?.findings?.filter(f => f.gitlabIssueId) || [];

  // Determine standard states
  let scannerState: 'completed' | 'failed' | 'running' | 'queued' = 'completed';
  if (selectedProj.status === 'SCANNING') {
    scannerState = 'running';
  } else if (selectedProj.status === 'FAILED') {
    scannerState = 'failed';
  }

  let reviewState: 'completed' | 'reviewable' | 'queued' = 'reviewable';
  if (totalFindingsCount === 0) {
    reviewState = 'completed';
  } else if (resolvedFindings.length === totalFindingsCount) {
    reviewState = 'completed';
  }

  let publishState: 'completed' | 'published' | 'queued' = 'queued';
  if (publishedFindings.length > 0) {
    publishState = 'published';
  } else if (totalFindingsCount === 0) {
    publishState = 'completed';
  }

  // Helper values for trace linkage
  const findingsList = matchingAudit?.findings || [];
  const findingIds = findingsList.map(f => f.id);
  const publishedFindingIds = findingsList.filter(f => f.gitlabIssueId).map(f => f.id);

  // Helper overrides for interactive sandbox trace simulation status tracking
  const getSimulatedStatus = (stepIdx: number, baseStatus: CanvasNode['status']): CanvasNode['status'] => {
    if (!isSimulating) return baseStatus;
    if (simulationIndex > stepIdx) return 'completed';
    if (simulationIndex === stepIdx) return 'running';
    return 'queued';
  };

  // Compute dynamic Nodes array based on the selected project context
  const nodes: CanvasNode[] = [
    {
      id: 'node-connect-vcs',
      label: 'Connect Provider',
      type: 'input',
      description: 'Ingest GitLab repository metadata & branches context',
      status: getSimulatedStatus(0, 'completed'),
      targetLinkTab: 'settings',
      x: 10,
      y: 10,
      metadata: {
        title: 'GitLab Provider Auth Gateway',
        timestamp: 'Synced 10 minutes ago',
        duration: '320ms',
        inputs: [`Repo: ${selectedProj.repoUrl}`, `Branch: ${selectedProj.branch}`, 'Auth: OIDC Vault Secure Claim'],
        outputs: ['JSON Commit Tree: HEAD', 'Pipeline Config YAML reference', 'Repository Owner token claims'],
        logs: [
          'Attempting secure handshakes with VCS Provider...',
          'Repository identity verified successfully via workspace keys.',
          'Checking out branch references: HEAD.'
        ],
        systemNote: 'Re-routing standard API transactions through air-gapped private VPC hosts setup in workspace parameters.',
        promptVersion: 'N/A',
        agentConfig: 'Git-Inbound-Daemon-v1.1',
        linkedFindingIds: []
      }
    },
    {
      id: 'node-scan-repo',
      label: 'Analyze CI & Config',
      type: 'execution',
      description: 'Parse pipeline YAML profiles and Docker configurations',
      status: getSimulatedStatus(1, scannerState === 'failed' ? 'partial' : scannerState),
      targetLinkTab: 'projects',
      x: 35,
      y: 10,
      metadata: {
        title: 'CI Scan Pipeline',
        duration: '1.2 seconds',
        timestamp: 'Last run: Just now',
        inputs: ['Source Dockerfile', 'Staging yaml configuration files', 'Local package manifests'],
        outputs: ['14 infrastructure descriptors parsed', '3 static compliance alarms raised'],
        logs: [
          'Reviewing workspace .gitlab-ci.yml pipelines triggers...',
          'Flagged unencrypted port bindings in microservice configuration.',
          'Environment manifests checked; fallback default passwords loaded.'
        ],
        systemNote: 'Cross-analyzing infrastructure dependencies against SOC2 Type II automated compliance gate definitions.',
        promptVersion: 'infrastructure-rulebook-v3.0',
        agentConfig: 'YAML-Config-Validator-v1.5',
        linkedFindingIds: []
      }
    },
    {
      id: 'node-run-audit',
      label: 'Run Premortem AI',
      type: 'execution',
      description: 'Trace data pathways and flag potential key leakages',
      status: getSimulatedStatus(2, scannerState),
      targetLinkTab: 'audits',
      x: 35,
      y: 50,
      metadata: {
        title: 'Premortem AI Reasoning Engine',
        duration: '4.8 seconds',
        timestamp: 'Analysis completed successfully',
        inputs: [selectedProj.scanCodeSnippet || 'Standard checkout code snippet', 'Prompt parameters context: v2.5.0'],
        outputs: [`${totalFindingsCount} vulnerability evidence chunks isolated`, `Compliance score calculated: ${selectedProj.lastAuditScore || 80}/100`],
        logs: [
          'Parsing custom variables scoping strings...',
          'Matching code tokens against unsecure transport strings.',
          'Synthesizing contextual prompt structures inside Server-Side Gemini API context...',
          'Injected trace step calculations successfully.'
        ],
        systemNote: 'Gemini reasoning temperature set to 0.2 default with strict context boundaries checks.',
        promptVersion: 'premortem-analysis-expert-v2.5',
        agentConfig: 'Gemini-3.5-Flash (Security Reasoning enabled)',
        linkedFindingIds: findingIds
      }
    },
    {
      id: 'node-cluster-risks',
      label: 'Cluster Risks',
      type: 'synthesis',
      description: 'Consolidate individual trace violations into deduplicated risk clusters',
      status: getSimulatedStatus(3, totalFindingsCount > 0 ? 'completed' : 'queued'),
      targetLinkTab: 'dashboard',
      x: 60,
      y: 10,
      metadata: {
        title: 'Synthesized Risk Cluster Deduplicator',
        duration: '850ms',
        inputs: [`${totalFindingsCount} raw evidence findings`],
        outputs: [totalFindingsCount > 0 ? '2 Unified Risk Clusters calculated' : 'No clusters required'],
        logs: [
          'Retrieving active findings arrays...',
          'Computing semantic similarity vectors on source violation segments...',
          'Clustered payments transport breaches and configuration fallbacks into persistent group definitions.'
        ],
        promptVersion: 'semantic-deduplicator-v1.2',
        agentConfig: 'K-Means Semantic Embeddings Classifier-v1.0',
        linkedFindingIds: findingIds
      }
    },
    {
      id: 'node-review-approval',
      label: 'Reviewer Approval',
      type: 'review',
      description: 'Human approval gateway controls (Merge, Dismiss, Split, Edit)',
      status: getSimulatedStatus(4, reviewState),
      targetLinkTab: 'audits',
      x: 60,
      y: 50,
      metadata: {
        title: 'Reviewer Approval Control Board',
        duration: 'Pending human actions',
        inputs: [totalFindingsCount > 0 ? `${totalFindingsCount} actionable findings candidates` : 'Empty findings'],
        outputs: [`Confirmed: ${matchingAudit?.findings?.filter(f => f.status === 'CONFIRMED').length || 0}`, `Resolved: ${resolvedFindings.length}`, `Dismissed: ${matchingAudit?.findings?.filter(f => f.status === 'DISMISSED').length || 0}`],
        logs: [
          'Awaiting reviewer authorization commands...',
          resolvedFindings.length > 0 ? `Confirmed code patch applied. Updating project score to: ${selectedProj.lastAuditScore || 80}/100` : 'No patch actions registered in queue.'
        ],
        systemNote: 'Security parameters require direct manual human confirmation before publishing workspace changes back to trunk repo.',
        promptVersion: 'human-in-the-loop-consensus-v2.0',
        agentConfig: 'Interactive-Approve-Terminal-v2.2',
        linkedFindingIds: findingIds
      }
    },
    {
      id: 'node-publish-gitlab',
      label: 'Sync GitLab Issues',
      type: 'publish',
      description: 'Serialize approved issue drafts directly back to repo work items',
      status: getSimulatedStatus(5, publishState),
      targetLinkTab: 'audits',
      x: 85,
      y: 30,
      metadata: {
        title: 'Operational GitLab Sync Connector',
        timestamp: 'Continuous synchronization',
        duration: '310ms',
        inputs: [`Approved issues draft templates`],
        outputs: [publishedFindings.length > 0 ? `${publishedFindings.length} Active GitLab Issue ticket mappings published` : '0 synchronized items'],
        logs: [
          'Encoding issue summaries markdown bodies...',
          publishedFindings.length > 0 
            ? `Dispatched issue create commands: ${publishedFindings.map(f => f.gitlabIssueId).join(', ')}`
            : 'No issues queued for publication. Confirm drafts inside review workspace desk.'
        ],
        promptVersion: 'gitlab-issue-serializer-v4.1',
        agentConfig: 'OAuth-GitLab-API-Client-v3.10',
        linkedFindingIds: publishedFindingIds
      }
    }
  ];

  const edges: CanvasEdge[] = [
    {
      id: 'edge-vcs-scan',
      from: 'node-connect-vcs',
      to: 'node-scan-repo',
      label: 'Repo Files Ingest',
      transformationDetail: 'VCS checking logs stream is matched against package list dependencies to establish audit scope guidelines.'
    },
    {
      id: 'edge-scan-audit',
      from: 'node-scan-repo',
      to: 'node-run-audit',
      label: 'Configs Context Influx',
      transformationDetail: 'CI/CD pipeline maps and Docker variables are injected directly into the Gemini prompt context window alongside source file snippets.'
    },
    {
      id: 'edge-audit-cluster',
      from: 'node-run-audit',
      to: 'node-cluster-risks',
      label: 'Extract Findings',
      transformationDetail: 'Raw trace alerts from AI engines are processed via semantic vector models to grouping identical errors.'
    },
    {
      id: 'edge-cluster-review',
      from: 'node-cluster-risks',
      to: 'node-review-approval',
      label: 'Actionable Items Mapping',
      transformationDetail: 'Deduplicated clusters are populated as structured draft templates with customizable fields to allow editing, merging, or splits.'
    },
    {
      id: 'edge-review-publish',
      from: 'node-review-approval',
      to: 'node-publish-gitlab',
      label: 'GitLab Sync Stream',
      transformationDetail: 'Upon manual confirmed review actions, secure payloads containing issue descriptions are published back to GitLab as real, traceable work tickets.'
    }
  ];

  const activeNode = nodes.find(n => n.id === activeNodeId);
  const activeEdge = edges.find(e => e.id === activeEdgeId);

  // Helper styles for node colors
  const getNodeStyles = (status: CanvasNode['status'], type: CanvasNode['type']) => {
    const isSelected = activeNodeId === nodes.find(n => n.type === type && n.status === status)?.id;
    let baseStyles = 'border bg-[#FDFDFD] hover:shadow-xs';
    let iconColor = 'text-zinc-500';
    let statusText = 'bg-zinc-100 text-zinc-600';

    if (status === 'completed') {
      baseStyles = 'border-emerald-700/40 bg-[#FAF8F5] shadow-xs text-zinc-900 border';
      iconColor = 'text-emerald-800';
      statusText = 'bg-emerald-50 text-emerald-800 font-bold';
    } else if (status === 'running') {
      baseStyles = 'border-amber-500/60 bg-amber-50/10 shadow-xs border animate-pulse';
      iconColor = 'text-amber-600 animate-spin-slow';
      statusText = 'bg-amber-100 text-amber-800 font-bold';
    } else if (status === 'reviewable') {
      baseStyles = 'border-indigo-650/40 bg-[#FDFDFD] border shadow-xs text-indigo-950 font-medium';
      iconColor = 'text-indigo-650';
      statusText = 'bg-[#F2EFF6] text-indigo-805 text-indigo-800 font-bold';
    } else if (status === 'published') {
      baseStyles = 'border-orange-500/50 bg-[#FAF8F5] border shadow-xs text-orange-950';
      iconColor = 'text-orange-600';
      statusText = 'bg-orange-50 text-orange-850 font-bold';
    } else if (status === 'partial') {
      baseStyles = 'border-amber-600 bg-[#FDFDFD] border-2 shadow-xs';
      iconColor = 'text-amber-750';
      statusText = 'bg-amber-50 text-amber-700 font-bold';
    } else if (status === 'failed') {
      baseStyles = 'border-rose-500/85 bg-rose-50/10 border-2 shadow-xs';
      iconColor = 'text-rose-600';
      statusText = 'bg-rose-50 text-rose-700 font-bold';
    } else {
      baseStyles = 'border-[#EAE6DF] bg-white opacity-60 text-zinc-400';
    }

    return { baseStyles, iconColor, statusText };
  };

  const executePipelineScan = () => {
    onTriggerScan(selectedProj.id);
    showToast(`Execution invoked. Triggering Premortem pipeline scanning sequence for "${selectedProj.name}"...`);
  };

  return (
    <div className="flex-1 flex overflow-hidden font-sans h-screen" id="workflow-canvas-hub">
      {/* Visual Canvas Area */}
      <div className="flex-1 flex flex-col h-full bg-[#FAF8F5] border-r border-[#EAE6DF] relative overflow-hidden">
        
        {/* Top Control Bar */}
        <div className="p-4 bg-white border-b border-[#EAE6DF] flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 z-20 shrink-0">
          <div className="space-y-0.5">
            <h2 className="text-sm font-bold tracking-tight text-[#1E2522] uppercase font-mono flex items-center gap-2">
              <Workflow size={14} className="text-emerald-900" />
              Open Audit Trace Canvas
            </h2>
            <p className="text-[11px] text-[#717A75]">
              Stateful visualization map of continuous audit pipelines, deduplication models, and issue publishing chains.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3.5 select-none">
            {/* Trace Simulator Control Panel */}
            <div className="flex items-center bg-[#FAF8F5] border border-[#EAE6DF] rounded p-1 px-2.5 gap-1.5 shadow-xs">
              <span className="font-mono text-[9px] uppercase font-bold text-[#8A958F] mr-1">Trace Player:</span>
              <button
                type="button"
                onClick={() => {
                  if (isSimulating) {
                    setIsSimulating(false);
                    setSimulationIndex(-1);
                    showToast('Simulation sequence aborted.');
                  } else {
                    setIsSimulating(true);
                    setSimulationIndex(0);
                    setActiveNodeId('node-connect-vcs');
                    setActiveEdgeId(null);
                    showToast('Live trace playback simulator initiated.');
                  }
                }}
                className={`py-1 px-2.5 rounded text-[9.5px] font-mono font-bold uppercase transition-all flex items-center gap-1 cursor-pointer leading-none ${
                  isSimulating 
                    ? 'bg-amber-700 hover:bg-amber-800 text-white' 
                    : 'bg-emerald-950 hover:bg-emerald-900 text-white'
                }`}
              >
                <span className={`w-1.5 h-1.5 rounded-full ${isSimulating ? 'bg-amber-300 animate-ping' : 'bg-emerald-300'}`} />
                <span>{isSimulating ? 'Stop Trace' : 'Simulate Trace'}</span>
              </button>
            </div>

            {/* Project dropdown selection */}
            <div className="space-y-0.5">
              <select
                value={selectedProjectId}
                onChange={(e) => {
                  setSelectedProjectId(e.target.value);
                  showToast(`Canvas scope swapped to "${projects.find(p => p.id === e.target.value)?.name}"`);
                }}
                className="p-1 px-2.5 border border-[#EAE6DF] bg-white rounded font-display focus:outline-none focus:border-emerald-950 font-bold text-xs text-[#1E2522]"
              >
                {projects.map(p => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            </div>

            <button
              onClick={executePipelineScan}
              disabled={selectedProj.status === 'SCANNING'}
              className="py-1 px-3 bg-emerald-950 hover:bg-emerald-900 text-[#FAF8F5] font-bold text-xs rounded transition-all cursor-pointer flex items-center gap-1.5 uppercase font-mono tracking-wider disabled:opacity-55"
            >
              <Play size={11} strokeWidth={2.5} />
              <span>{selectedProj.status === 'SCANNING' ? 'Running...' : 'Execute Stream'}</span>
            </button>
          </div>
        </div>

        {/* The Grid Canvas Surface with custom SVGs Connective curves */}
        <div className="flex-1 overflow-auto p-8 relative flex items-center justify-center min-h-[500px] select-none" style={{ backgroundImage: 'radial-gradient(#EAE6DF 1.2px, transparent 1.2px)', backgroundSize: '24px 24px' }}>
          
          {isSimulating && (
            <div className="absolute top-4 left-1/2 -translate-x-1/2 z-30 bg-amber-50 border border-amber-300 text-amber-950 rounded-full p-2 px-6 text-[10px] font-mono font-bold shadow-md flex items-center gap-2 animate-bounce select-none">
              <span className="w-2 h-2 rounded-full bg-amber-550 bg-amber-600 animate-ping" />
              <span>TRACE SIMULATION: STEP {simulationIndex + 1} of 6: "{nodes[simulationIndex]?.label || 'Active Gateway'}"</span>
            </div>
          )}
          
          {/* Edge Connection SVG Overlay */}
          <svg className="absolute inset-0 w-full h-full pointer-events-none z-0">
            <defs>
              <marker id="arrow" viewBox="0 0 10 10" refX="6" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
                <path d="M 0 1.5 L 7 5 L 0 8.5 z" fill="#8A958F" />
              </marker>
              <marker id="arrow-active" viewBox="0 0 10 10" refX="6" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
                <path d="M 0 1.5 L 7 5 L 0 8.5 z" fill="#047857" />
              </marker>
            </defs>

            {/* Let's draw bezier paths based on approximate node placements in % */}
            {edges.map((edge) => {
              const fromNode = nodes.find(n => n.id === edge.from);
              const toNode = nodes.find(n => n.id === edge.to);
              if (!fromNode || !toNode) return null;

              // Grid size is roughly mapped physically. 
              // Convert % coordinates into absolute placeholders if needed,
              // but we can compute elegant responsive vectors in percentage-like viewport paths!
              // For robustness, coordinate paths are computed perfectly:
              const fromX = `${fromNode.x}%`;
              const fromY = `${fromNode.y}%`;
              const toX = `${toNode.x}%`;
              const toY = `${toNode.y}%`;

              const isActive = activeEdgeId === edge.id;
              const isPathCompleted = fromNode.status === 'completed' && toNode.status !== 'queued';

              return (
                <g key={edge.id} className="pointer-events-auto cursor-pointer" onClick={(e) => {
                  e.stopPropagation();
                  setActiveEdgeId(edge.id);
                  setActiveNodeId(null);
                  showToast(`Selected integration connector gap: "${edge.label}"`);
                }}>
                  {/* Outer thicker invisible interactive hit path */}
                  <path
                    d={`M ${fromNode.x} ${fromNode.y} L ${toNode.x} ${toNode.y}`}
                    className="stroke-transparent cursor-pointer"
                    strokeWidth={20}
                    style={{
                      transformBox: 'fill-box',
                      transform: 'translate(0, 0)',
                    }}
                  />
                  <line
                    x1={`${fromNode.x}%`}
                    y1={`${fromNode.y + 7.5}%`}
                    x2={`${toNode.x}%`}
                    y2={`${toNode.y + 7.5}%`}
                    stroke={isActive ? '#047857' : isPathCompleted ? '#10B981' : '#CDC7BD'}
                    strokeWidth={isActive ? 3 : 2}
                    className="transition-all duration-300"
                    strokeDasharray={(!isPathCompleted && fromNode.status !== 'queued') ? '5,5' : 'none'}
                    markerEnd={isActive ? 'url(#arrow-active)' : 'url(#arrow)'}
                  />
                  {/* Circle bubble on center of the path for labeling/insights */}
                  <foreignObject 
                    x={`${(fromNode.x + toNode.x) / 2 - 3.5}%`} 
                    y={`${(fromNode.y + toNode.y) / 2 + 3.8}%`} 
                    width="120" 
                    height="30"
                    className="overflow-visible"
                  >
                    <div className={`p-1 px-1.5 rounded border shadow-xs text-[8px] font-mono text-center tracking-tight truncate ${
                      isActive 
                        ? 'bg-emerald-950 text-white border-emerald-950 font-bold' 
                        : 'bg-white border-[#EAE6DF] text-zinc-500 hover:border-zinc-400'
                    }`}>
                      {edge.label}
                    </div>
                  </foreignObject>
                </g>
              );
            })}
          </svg>

          {/* Render Nodes element items as clean structured cards */}
          <div className="absolute inset-0 w-full h-full z-10 pointer-events-none">
            {nodes.map((node) => {
              const { baseStyles, iconColor, statusText } = getNodeStyles(node.status, node.type);
              const isSelected = activeNodeId === node.id;
              
              // Map types to visual icons
              const IconComp = (() => {
                if (node.type === 'input') return Database;
                if (node.type === 'execution') return Activity;
                if (node.type === 'synthesis') return Layers;
                if (node.type === 'review') return ThumbsUp;
                return CloudLightning;
              })();

              return (
                <div
                  key={node.id}
                  onClick={(e) => {
                    e.stopPropagation();
                    setActiveNodeId(node.id);
                    setActiveEdgeId(null);
                    showToast(`Active inspection target shifted to: "${node.label}"`);
                  }}
                  className={`absolute pointer-events-auto p-3 px-4 rounded-lg w-56 text-xs transition-all cursor-pointer flex flex-col justify-between select-none ${baseStyles} ${
                    isSelected ? 'ring-2 ring-emerald-950 ring-offset-2 scale-103 shadow-md' : 'shadow-xs border'
                  }`}
                  style={{
                    left: `${node.x}%`,
                    top: `${node.y}%`,
                    transform: 'translate(-50%, -50%)'
                  }}
                >
                  <div className="flex justify-between items-start gap-1">
                    <span className="text-[8px] uppercase tracking-wider font-mono text-[#8A958F] font-bold">
                      {node.type} node
                    </span>
                    
                    <span className={`text-[7.5px] uppercase font-mono px-1 py-0.2 rounded font-bold ${statusText}`}>
                      {node.status}
                    </span>
                  </div>

                  <div className="flex gap-2.5 items-center mt-2.5 mb-2">
                    <div className={`p-1.5 rounded bg-white/60 border ${iconColor}`}>
                      <IconComp size={14} />
                    </div>
                    <div>
                      <h4 className="font-bold text-[#1E2522] tracking-tight">{node.label}</h4>
                      <p className="text-[10px] text-[#717A75] leading-none mt-0.5 truncate max-w-[140px]">{node.description}</p>
                    </div>
                  </div>

                  {/* Tiny metadata preview to feel authentic */}
                  {node.status === 'completed' && node.metadata.timestamp && (
                    <div className="border-t border-[#EAE6DF]/60 pt-1.5 flex items-center gap-1 text-[9px] text-zinc-400 font-mono">
                      <Clock size={10} />
                      <span className="truncate">{node.metadata.timestamp}</span>
                    </div>
                  )}

                  {node.id === 'node-review-approval' && totalFindingsCount > 0 && (
                    <div className="border-t border-[#EAE6DF]/60 pt-1.5 flex items-center justify-between text-[9px] text-zinc-500 font-mono">
                      <span>OPEN RISKS:</span>
                      <span className="font-bold text-rose-600">{matchingAudit?.findings?.filter(f => f.status === 'OPEN').length || 0}</span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

        </div>

        {/* Selection / Context Footer banner */}
        {activeEdge && (
          <div className="z-20 bg-emerald-950 border-t border-emerald-900 text-[#FAF8F5] p-3 px-6 text-xs flex items-center justify-between font-mono animate-fadeIn shrink-0">
            <div className="flex items-center gap-3">
              <span className="text-emerald-450 font-bold tracking-wider uppercase text-[10px]">PATH TRANSLATOR:</span>
              <span className="font-bold text-white">{activeEdge.from} → {activeEdge.to}</span>
              <span className="text-emerald-300">({activeEdge.label})</span>
            </div>
            <p className="max-w-xl text-right text-[11px] text-emerald-200">
              {activeEdge.transformationDetail}
            </p>
          </div>
        )}
      </div>

      {/* Right Drawer Inspect Panel */}
      <div className="w-96 bg-white shrink-0 flex flex-col h-full overflow-hidden" id="canvas-inspect-panel">
        
        {/* Panel Header */}
        <div className="p-6 border-b border-[#EAE6DF] bg-[#FAF8F5]/50 flex justify-between items-center shrink-0">
          <div className="space-y-0.5">
            <span className="text-[9px] uppercase tracking-widest font-mono text-[#8A958F] font-bold block">
              Node Context Inspector
            </span>
            <h3 className="text-md font-bold tracking-tight text-[#1E2522] font-display">
              {activeNode ? activeNode.metadata.title : 'Segment Inspection'}
            </h3>
          </div>
          
          <button 
            type="button" 
            onClick={() => setActiveNodeId(null)}
            className="text-[#8A958F] hover:text-[#1E2522] p-1.5 rounded hover:bg-[#FAF8F5] transition-all cursor-pointer"
          >
            <X size={15} />
          </button>
        </div>

        {/* Panel Scroll Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6 text-xs">
          {activeNode ? (
            <div className="space-y-6">
              
              {/* STATUS & RUN DURATION METADATA GRIDS */}
              <div className="grid grid-cols-2 gap-3 pb-2">
                <div className="p-3 bg-[#FAF8F5] border border-[#EAE6DF] rounded flex flex-col justify-between">
                  <span className="text-[8px] font-mono text-[#8A958F] font-bold uppercase tracking-wider block mb-1">
                    RUN DURATION
                  </span>
                  <span className="font-mono text-[11.5px] font-bold text-emerald-950">
                    {isSimulating && simulationIndex === nodes.indexOf(nodes.find(n => n.id === activeNode.id)!)
                      ? 'calculating...'
                      : activeNode.metadata.duration || '310ms'}
                  </span>
                </div>
                <div className="p-3 bg-[#FAF8F5] border border-[#EAE6DF] rounded flex flex-col justify-between">
                  <span className="text-[8px] font-mono text-[#8A958F] font-bold uppercase tracking-wider block mb-1">
                    AUDIT STEP STATUS
                  </span>
                  <span className={`font-mono text-[10.5px] font-bold uppercase block ${
                    activeNode.status === 'completed' || activeNode.status === 'published'
                      ? 'text-emerald-700'
                      : activeNode.status === 'running'
                      ? 'text-amber-650 text-amber-600 animate-pulse font-bold'
                      : activeNode.status === 'failed'
                      ? 'text-rose-700 font-bold'
                      : 'text-zinc-500'
                  }`}>
                    ● {activeNode.status}
                  </span>
                </div>
              </div>

              {/* TRACE COMPLIANCE PIPELINES */}
              {(activeNode.metadata.promptVersion || activeNode.metadata.agentConfig) && (
                <div className="p-3 bg-neutral-50 border border-zinc-200 rounded space-y-2">
                  <span className="text-[8px] font-mono text-[#8A958F] font-bold uppercase tracking-wider block">
                    TRACE ORCHESTRATION CONTEXT
                  </span>
                  <div className="grid grid-cols-1 gap-1.5 font-mono text-[10px] text-zinc-700 leading-tight">
                    {activeNode.metadata.promptVersion && (
                      <div className="flex justify-between items-center bg-white p-1.5 px-2.5 rounded border border-zinc-150">
                        <span className="text-[#8A958F]">PROMPT:</span>
                        <span className="font-bold text-neutral-850 truncate max-w-[190px]">{activeNode.metadata.promptVersion}</span>
                      </div>
                    )}
                    {activeNode.metadata.agentConfig && (
                      <div className="flex justify-between items-center bg-white p-1.5 px-2.5 rounded border border-zinc-150">
                        <span className="text-[#8A958F]">AI CLIENT:</span>
                        <span className="font-bold text-neutral-850 truncate max-w-[190px]">{activeNode.metadata.agentConfig}</span>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Dynamic Action Trigger/Description box */}
              <div className="p-4 bg-zinc-50 border border-zinc-200 rounded space-y-2.5">
                <div className="flex justify-between items-center text-[10px] font-mono">
                  <span className="text-zinc-400 font-bold uppercase">EXECUTION METADATA</span>
                  <span className="font-semibold text-zinc-500">Pipeline Stage</span>
                </div>
                <p className="text-neutral-700 leading-relaxed font-sans select-text">
                  {activeNode.description}
                </p>

                <div className="pt-1 select-none">
                  <button 
                    onClick={() => {
                      showToast(`Navigating to target interface workspace...`);
                      setActiveTab(activeNode.targetLinkTab);
                    }}
                    className="py-1 px-2.5 border border-[#CDC7BD] bg-white rounded font-semibold text-neutral-800 flex items-center justify-center gap-1 transition-all hover:bg-neutral-50 text-[10px] w-full cursor-pointer font-mono uppercase tracking-wide"
                  >
                    <span>View in {activeNode.targetLinkTab.toUpperCase()} tab</span>
                    <ChevronRight size={12} />
                  </button>
                </div>
              </div>

              {/* LINKED FINDINGS */}
              {activeNode.metadata.linkedFindingIds && activeNode.metadata.linkedFindingIds.length > 0 && (
                <div className="space-y-2 pt-1 border-t border-zinc-100">
                  <div className="flex justify-between items-center">
                    <h4 className="text-[10px] font-mono tracking-wider font-bold text-[#8A958F] uppercase">
                      LINKED FINDINGS ({activeNode.metadata.linkedFindingIds.length})
                    </h4>
                    <span className="text-[8px] font-mono text-zinc-400">Click to preview</span>
                  </div>
                  
                  <div className="space-y-1.5">
                    {activeNode.metadata.linkedFindingIds.map((fId) => {
                      const fObj = findingsList.find(f => f.id === fId);
                      const isDetailActive = selectedFindingIdForDetail === fId;
                      if (!fObj) return null;
                      return (
                        <div key={fId} className="space-y-1.5">
                          <button
                            type="button"
                            onClick={() => setSelectedFindingIdForDetail(isDetailActive ? null : fId)}
                            className={`p-2 rounded font-mono text-[10px] border transition-all cursor-pointer select-none flex items-center justify-between gap-2 w-full text-left ${
                              isDetailActive
                                ? 'bg-[#1E2522] border-[#1E2522] text-white font-bold'
                                : fObj.severity === 'CRITICAL' || fObj.severity === 'HIGH'
                                ? 'bg-rose-50/50 border-rose-200 text-rose-900 hover:bg-rose-50'
                                : 'bg-zinc-50 border-zinc-200 text-zinc-700 hover:bg-zinc-100/50'
                            }`}
                          >
                            <span className="truncate flex items-center gap-1.5">
                              <span className="text-[8px] bg-white/70 px-1 border min-w-[28px] text-center text-zinc-500 rounded py-0.2 font-mono">{fId}</span>
                              <span className="truncate max-w-[170px]">{fObj.title}</span>
                            </span>
                            <span className={`text-[8px] px-1 py-0.2 rounded font-bold uppercase shrink-0 ${
                              fObj.severity === 'CRITICAL' || fObj.severity === 'HIGH'
                                ? 'bg-rose-600 text-white'
                                : 'bg-zinc-200 text-zinc-700'
                            }`}>
                              {fObj.severity}
                            </span>
                          </button>

                          {/* Expanded detail box in sidepanel */}
                          {isDetailActive && (
                            <div className="p-3 bg-[#FAF8F5] border border-emerald-850/20 rounded shadow-xs space-y-2 mt-0.5 animate-fadeIn select-text leading-relaxed font-sans text-neutral-800">
                              <div className="flex justify-between items-center text-[8.5px] font-mono pb-1 border-b">
                                <span className="text-emerald-800 font-bold uppercase">TRACE EVIDENCE</span>
                                <span className="text-zinc-500">File: {fObj.filepath}:{fObj.line}</span>
                              </div>
                              <p className="text-[10.5px] font-semibold text-zinc-900 leading-tight">
                                {fObj.title}
                              </p>
                              <p className="text-[10px] text-neutral-600 leading-relaxed">
                                {fObj.description}
                              </p>
                              {fObj.recommendation && (
                                <div className="p-2 bg-white border rounded text-[9.5px] text-emerald-950 font-mono">
                                  <span className="font-bold text-[8.5px] block text-emerald-800 uppercase mb-0.5">REMEDY CODE ACTION:</span>
                                  <span className="leading-snug">{fObj.recommendation}</span>
                                </div>
                              )}
                              <div className="pt-1.5">
                                <button
                                  type="button"
                                  onClick={() => {
                                    showToast(`Navigating to active manual audit desk workspace...`);
                                    setActiveTab('audits');
                                  }}
                                  className="py-1 px-3 bg-[#1E2522] hover:bg-emerald-950 text-white text-[9.5px] font-bold rounded uppercase tracking-wider font-mono flex items-center gap-1 w-full justify-center cursor-pointer"
                                >
                                  <span>Deep-Dive Review Trace</span>
                                  <ChevronRight size={11} />
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Node Inputs Array */}
              {activeNode.metadata.inputs && activeNode.metadata.inputs.length > 0 && (
                <div className="space-y-2">
                  <h4 className="text-[10px] font-mono tracking-wider font-bold text-[#8A958F] uppercase">
                    INPUT PARAMETERS
                  </h4>
                  <div className="space-y-1.5 font-mono text-[10.5px]">
                    {activeNode.metadata.inputs.map((inp, iIdx) => (
                      <div key={iIdx} className="bg-[#FAF8F5] border border-[#EAE6DF] rounded p-2 select-text font-bold text-[#1E2522]">
                        <span className="text-zinc-400 mr-1 bg-white px-1.5 border py-0.2 rounded text-[9px]">{iIdx + 1}</span>
                        {inp}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Node Outputs Array */}
              {activeNode.metadata.outputs && activeNode.metadata.outputs.length > 0 && (
                <div className="space-y-2">
                  <h4 className="text-[10px] font-mono tracking-wider font-bold text-[#8A958F] uppercase">
                    PRODUCED OUTCOMES
                  </h4>
                  <div className="space-y-1.5 font-mono text-[10.5px]">
                    {activeNode.metadata.outputs.map((out, oIdx) => (
                      <div key={oIdx} className="bg-emerald-50/25 border border-emerald-200/50 rounded p-2 text-emerald-950 font-medium select-text">
                        <span className="text-emerald-700 mr-2 bg-white px-1.5 border py-0.2 rounded text-[9px] font-bold">OUT</span>
                        {out}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Node System Note */}
              {activeNode.metadata.systemNote && (
                <div className="p-3 bg-[#F2EFF6]/20 border border-[#EAE6DF] text-zinc-650 rounded flex gap-2 font-sans select-text">
                  <Info className="text-neutral-700 shrink-0 mt-0.5" size={14} />
                  <p className="text-[10.5px]">
                    {activeNode.metadata.systemNote}
                  </p>
                </div>
              )}

              {/* Node Telemetry Execution logs */}
              {activeNode.metadata.logs && activeNode.metadata.logs.length > 0 && (
                <div className="space-y-2">
                  <h4 className="text-[10px] font-mono tracking-wider font-bold text-[#8A958F] uppercase">
                    NODE EXECUTION TRAIL LOGS
                  </h4>
                  <div className="bg-neutral-900 text-[#FAF8F5] rounded p-3 font-mono text-[9px] space-y-1.5 shadow-inner select-text">
                    {activeNode.metadata.logs.map((log, lIdx) => (
                      <div key={lIdx} className="flex gap-2">
                        <span className="text-zinc-500 font-bold select-none">[{lIdx + 1}]</span>
                        <span className="leading-normal">{log}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

            </div>
          ) : activeEdge ? (
            <div className="space-y-4">
              <div className="p-4 bg-emerald-50 text-emerald-800 border border-emerald-200 rounded space-y-1">
                <span className="text-[9px] font-mono uppercase font-bold tracking-wider">Gateway Transformer</span>
                <h4 className="font-semibold text-emerald-950">{activeEdge.label}</h4>
              </div>
              <p className="text-[#5C6560] leading-relaxed select-text">
                {activeEdge.transformationDetail}
              </p>
              
              <div className="p-3 bg-[#FAF8F5] border border-[#EAE6DF] text-[#717A75] rounded select-text">
                <span className="font-bold text-neutral-800 uppercase font-mono text-[9px] block mb-1">DATA FLOW PIPELINE</span>
                <p className="text-[10.5px]">
                  All intermediate files parsing are stored temporarily within air-gapped memory space and discarded immediately upon completing the published sync routine.
                </p>
              </div>
            </div>
          ) : (
            <div className="h-48 flex flex-col items-center justify-center p-8 text-center text-[#717A75] bg-[#FAF8F5] rounded border border-dashed border-[#EAE6DF] font-mono select-none">
              <Workflow size={24} className="text-zinc-350 animate-pulse mb-2.5" />
              <span>Select any canvas node or flow edge to inspect underlying audit pipeline parameters.</span>
            </div>
          )}
        </div>

        {/* Drawer footer */}
        <div className="p-4 bg-[#FAF8F5] border-t text-center font-mono text-[9px] text-[#8A958F] uppercase tracking-wide shrink-0 font-bold">
          PREMORTEM SECURE PLATFORM
        </div>

      </div>

      {/* Floating dynamic success notification banner */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 bg-emerald-950 border border-emerald-800 text-[#FAF8F5] p-3 px-5 rounded text-xs flex items-center gap-2 shadow-xl font-mono uppercase tracking-wider animate-fadeIn">
          <CheckCircle2 size={14} className="text-emerald-450" />
          <span>{toastMessage}</span>
        </div>
      )}

    </div>
  );
}
