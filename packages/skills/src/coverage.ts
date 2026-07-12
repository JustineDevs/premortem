import type { SkillRegistry, SkillRegistryAgent } from './registry';

export interface SkillCoverageAgentSignal {
  agentName: string;
  categories: string[];
  runMode: 'always' | 'conditional';
  completed: boolean;
  findingCount: number;
  issueCandidateCount: number;
  coverageState: 'covered' | 'gap' | 'insufficient_context';
  reasons: string[];
}

export interface SkillCoverageReport {
  reportId: string;
  generatedAt: string;
  organizationId: string;
  projectId: string;
  auditRunId: string;
  runStatus: string;
  registryProject: string;
  registryVersion: number;
  totalCategories: number;
  coveredCategories: string[];
  missingCategories: string[];
  zeroFindingCategories: string[];
  insufficientContextCategories: string[];
  agentCoverage: SkillCoverageAgentSignal[];
  coverageRatio: number;
  storageRef?: string | null;
}

export interface SkillCoverageSourceAgentRun {
  agentName: string;
  status: string;
}

export interface SkillCoverageSourceFinding {
  agent: string;
  category: string;
}

export interface SkillCoverageSourceIssueCandidate {
  category: string;
  sourceAgents?: string[];
}

export interface SkillCoverageInput {
  organizationId: string;
  projectId: string;
  auditRunId: string;
  runStatus: string;
  generatedAt?: string;
  registry: SkillRegistry;
  agentRuns: SkillCoverageSourceAgentRun[];
  findings: SkillCoverageSourceFinding[];
  issueCandidates: SkillCoverageSourceIssueCandidate[];
}

function compactUnique(values: string[]) {
  return Array.from(new Set(values.filter((value) => value.length > 0))).sort((left, right) =>
    left.localeCompare(right)
  );
}

function categoryMap(registry: SkillRegistry) {
  const map = new Map<string, SkillRegistryAgent[]>();
  for (const agent of registry.agents) {
    for (const category of agent.owns_categories ?? []) {
      const bucket = map.get(category) ?? [];
      bucket.push(agent);
      map.set(category, bucket);
    }
  }
  return map;
}

export function buildSkillCoverageReport(input: SkillCoverageInput): SkillCoverageReport {
  const reportId = `${input.auditRunId}:skills`;
  const generatedAt = input.generatedAt ?? new Date().toISOString();
  const findingCountByAgent = new Map<string, number>();
  const issueCandidateCountByAgent = new Map<string, number>();

  for (const finding of input.findings) {
    findingCountByAgent.set(finding.agent, (findingCountByAgent.get(finding.agent) ?? 0) + 1);
  }

  for (const issue of input.issueCandidates) {
    for (const agentName of issue.sourceAgents ?? []) {
      issueCandidateCountByAgent.set(
        agentName,
        (issueCandidateCountByAgent.get(agentName) ?? 0) + 1
      );
    }
  }

  const categoryOwners = categoryMap(input.registry);
  const categorySignals = new Map<
    string,
    {
      covered: boolean;
      completed: boolean;
      findingCount: number;
      issueCandidateCount: number;
    }
  >();

  for (const [category, owners] of categoryOwners.entries()) {
    const categoryAgents = owners.map((agent) => agent.name);
    const findingCount = categoryAgents.reduce(
      (total, agentName) => total + (findingCountByAgent.get(agentName) ?? 0),
      0
    );
    const issueCandidateCount = categoryAgents.reduce(
      (total, agentName) => total + (issueCandidateCountByAgent.get(agentName) ?? 0),
      0
    );
    const completed = categoryAgents.some((agentName) =>
      input.agentRuns.some((run) => run.agentName === agentName && run.status === 'completed')
    );

    categorySignals.set(category, {
      covered: findingCount + issueCandidateCount > 0,
      completed,
      findingCount,
      issueCandidateCount
    });
  }

  const agentCoverage = input.registry.agents.map((agent) => {
    const categories = agent.owns_categories ?? [];
    const findingCount = findingCountByAgent.get(agent.name) ?? 0;
    const issueCandidateCount = issueCandidateCountByAgent.get(agent.name) ?? 0;
    const completed = input.agentRuns.some(
      (run) => run.agentName === agent.name && run.status === 'completed'
    );
    const coverageState: SkillCoverageAgentSignal['coverageState'] =
      findingCount + issueCandidateCount > 0
        ? 'covered'
        : completed
          ? 'gap'
          : 'insufficient_context';
    const reasons = [
      completed ? 'Agent completed.' : 'Agent did not complete.',
      findingCount > 0 ? `${findingCount} finding(s) produced.` : 'No findings produced.',
      issueCandidateCount > 0
        ? `${issueCandidateCount} issue candidate(s) mapped from this agent.`
        : 'No issue candidates mapped from this agent.'
    ];

    return {
      agentName: agent.name,
      categories,
      runMode: agent.run_mode,
      completed,
      findingCount,
      issueCandidateCount,
      coverageState,
      reasons
    };
  });

  const coveredCategories = compactUnique(
    Array.from(categorySignals.entries())
      .filter(([, signal]) => signal.covered)
      .map(([category]) => category)
  );
  const zeroFindingCategories = compactUnique(
    Array.from(categorySignals.entries())
      .filter(([, signal]) => !signal.covered && signal.completed)
      .map(([category]) => category)
  );
  const insufficientContextCategories = compactUnique(
    Array.from(categorySignals.entries())
      .filter(([, signal]) => !signal.covered && !signal.completed)
      .map(([category]) => category)
  );
  const missingCategories = compactUnique([
    ...zeroFindingCategories,
    ...insufficientContextCategories
  ]);

  return {
    reportId,
    generatedAt,
    organizationId: input.organizationId,
    projectId: input.projectId,
    auditRunId: input.auditRunId,
    runStatus: input.runStatus,
    registryProject: input.registry.project,
    registryVersion: input.registry.version,
    totalCategories: categoryOwners.size,
    coveredCategories,
    missingCategories,
    zeroFindingCategories,
    insufficientContextCategories,
    agentCoverage,
    coverageRatio: categoryOwners.size > 0 ? coveredCategories.length / categoryOwners.size : 1
  };
}
