export type ProviderType = 'github' | 'gitlab' | 'bitbucket' | 'aws' | 'azure' | 'gitea' | 'gcp' | 'custom_git';

export interface Project {
  id: string;
  name: string;
  provider: ProviderType;
  repoUrl: string;
  branch: string;
  status: 'COMPLIANT' | 'WARNING' | 'FAILED' | 'SCANNING';
  lastAuditScore: number | null;
  lastAuditDate: string | null;
  infrastructureCount: number;
  apiEndpointsCount: number;
  unencryptedEndpointsCount: number;
  scanCodeSnippet?: string;
}

export type SeverityType = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
export type IssueStatusType = 'OPEN' | 'CONFIRMED' | 'DISMISSED' | 'RESOLVED';

export interface TraceStep {
  step: number;
  description: string;
  location: string;
  codeSnippet?: string;
}

export interface Finding {
  id: string;
  title: string;
  severity: SeverityType;
  status: IssueStatusType;
  category: string;
  filepath: string;
  line: number;
  description: string;
  evidence: string;
  trace: TraceStep[];
  recommendation: string;
  aiReasoning: string;
  patchApplied?: boolean;
  suggestedPatchCode?: string;
  expectedBehavior?: string;
  successCriteria?: string;
  whyItMatters?: string;
  gitlabIssueId?: string;
  isSplitted?: boolean;
  mergedIntoId?: string;
}

export interface AuditRun {
  id: string;
  projectId: string;
  projectName: string;
  score: number;
  status: 'COMPLETED' | 'FAILED' | 'RUNNING';
  date: string;
  criticalCount: number;
  highCount: number;
  mediumCount: number;
  lowCount: number;
  findings: Finding[];
}

export interface RiskCluster {
  id: string;
  name: string;
  description: string;
  severity: SeverityType;
  findingsCount: number;
  projectIds: string[];
}
