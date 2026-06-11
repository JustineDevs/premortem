export type SwarmLaneId = 'repository' | 'runtime';

export interface SwarmLaneAgent {
  id: string;
  name: string;
  lens: string;
  status: 'COMPLETED' | 'FAILED' | 'ACTIVE';
  boundedFiles: string[];
  memoryState: string;
  findingsCount: number;
  logs: string[];
  lane: SwarmLaneId;
}

export interface SwarmTimelineAction {
  id: string;
  lane: SwarmLaneId;
  timestamp: string;
  agentName: string;
  message: string;
  severity?: string;
}

const REPOSITORY_LENS_PATTERN =
  /topology|artifact|dependency|supply|test|onboarding|operability|integrity/i;
const RUNTIME_LENS_PATTERN =
  /release|integration|boundary|trust|observability|recovery|validator|synth|publish/i;

export function classifySwarmLane(agentName: string): SwarmLaneId {
  if (RUNTIME_LENS_PATTERN.test(agentName)) return 'runtime';
  if (REPOSITORY_LENS_PATTERN.test(agentName)) return 'repository';
  return 'repository';
}

export function splitAgentsIntoLanes<T extends { id: string; name: string }>(
  agents: T[]
): { repository: T[]; runtime: T[] } {
  const repository: T[] = [];
  const runtime: T[] = [];

  for (const agent of agents) {
    const lane = classifySwarmLane(agent.name);
    if (lane === 'runtime') runtime.push(agent);
    else repository.push(agent);
  }

  if (repository.length === 0 && runtime.length === 0) {
    return { repository: [], runtime: [] };
  }

  if (repository.length === 0 && runtime.length > 0) {
    const pivot = runtime.splice(0, Math.ceil(runtime.length / 2));
    repository.push(...pivot);
  }

  if (runtime.length === 0 && repository.length > 1) {
    const pivot = repository.splice(Math.ceil(repository.length / 2));
    runtime.push(...pivot);
  }

  return { repository, runtime };
}

export function buildSwarmTimelineActions(input: {
  events: Array<{ eventType: string; actor: string; createdAt: string }>;
  findings: Array<{ id: string; title: string; severity: string; agentRunId: string }>;
  agentRuns: Array<{ id: string; agentName: string }>;
}): SwarmTimelineAction[] {
  const agentNameById = new Map(input.agentRuns.map((run) => [run.id, run.agentName]));
  const actions: SwarmTimelineAction[] = [];

  for (const event of input.events) {
    actions.push({
      id: `event-${event.createdAt}-${event.eventType}`,
      lane: classifySwarmLane(event.actor),
      timestamp: event.createdAt,
      agentName: event.actor,
      message: event.eventType.replace(/_/g, ' ')
    });
  }

  for (const finding of input.findings) {
    const agentName = agentNameById.get(finding.agentRunId) ?? 'specialist_agent';
    actions.push({
      id: `finding-${finding.id}`,
      lane: classifySwarmLane(agentName),
      timestamp: new Date().toISOString(),
      agentName,
      message: finding.title,
      severity: finding.severity
    });
  }

  return [...actions]
    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
    .slice(0, 24);
}
