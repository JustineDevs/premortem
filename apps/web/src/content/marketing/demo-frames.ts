import type { MarketingDemoStepId } from '@/content/marketing/pricing';

export type MarketingDemoFrame = {
  id: string;
  stepId: MarketingDemoStepId;
  phase: string;
  headline: string;
  lines: readonly [string, string];
  metrics: readonly { label: string; value: string }[];
  progress: number;
  log: string;
  screenshot: {
    src: string;
    alt: string;
  };
};

/** Ordered product walkthrough mapped to public/static/0.png through 11.png. */
export const marketingDemoFrames: readonly MarketingDemoFrame[] = [
  {
    id: 'overview',
    stepId: 'connect',
    phase: '01 · Connect',
    headline: 'Premortem on your repo before production breaks',
    lines: [
      'Connect GitLab, register a repository, and bind the branch you ship.',
      'OAuth scopes cover repo read, CI context, and issue publish.'
    ],
    metrics: [
      { label: 'Provider', value: 'GitLab' },
      { label: 'Flow', value: '3 steps' },
      { label: 'Console', value: '/app' }
    ],
    progress: 8,
    log: 'landing · connect GitLab · register repository',
    screenshot: {
      src: '/landing/demo/0.png',
      alt: 'Premortem landing overview with connect, scan, and review workflow'
    }
  },
  {
    id: 'providers',
    stepId: 'connect',
    phase: '01 · Connect',
    headline: 'Authorize GitLab in Integrations & Scope',
    lines: [
      'OAuth completes via Supabase with read_user, api, and read_repository scopes.',
      'Tokens persist for publish and reconciliation workers.'
    ],
    metrics: [
      { label: 'Provider', value: 'GitLab' },
      { label: 'Status', value: 'Connected' },
      { label: 'Scopes', value: '3' }
    ],
    progress: 16,
    log: 'integrations · gitlab oauth · repository access ready',
    screenshot: {
      src: '/landing/demo/11.png',
      alt: 'Premortem workspace Integrations and Scope with GitLab connected'
    }
  },
  {
    id: 'projects',
    stepId: 'connect',
    phase: '01 · Connect',
    headline: 'Register the repository asset to audit',
    lines: [
      'Projects Inventory lists every enabled repo with branch and provider host.',
      'Ad-hoc snippets can also be registered for sandbox analysis.'
    ],
    metrics: [
      { label: 'Surface', value: 'Projects' },
      { label: 'Branch', value: 'main' },
      { label: 'Provider', value: 'GitLab' }
    ],
    progress: 25,
    log: 'projects · register repository · target branch main',
    screenshot: {
      src: '/landing/demo/2.png',
      alt: 'Premortem Projects Inventory register repository form'
    }
  },
  {
    id: 'dashboard',
    stepId: 'run',
    phase: '02 · Audit',
    headline: 'Monitor dashboard tracks runtime and compliance',
    lines: [
      'Operations runtime shows pipeline progress, agent count, and terminal output.',
      'Severity ledger summarizes critical, high, medium, and low findings.'
    ],
    metrics: [
      { label: 'Agents', value: '24' },
      { label: 'Pipeline', value: '100%' },
      { label: 'Findings', value: '132' }
    ],
    progress: 33,
    log: 'dashboard · operations runtime · pipeline completed',
    screenshot: {
      src: '/landing/demo/1.png',
      alt: 'Premortem Monitor Dashboard with operations runtime and severity ledger'
    }
  },
  {
    id: 'workflow-canvas',
    stepId: 'run',
    phase: '02 · Audit',
    headline: 'Workflow canvas traces the audit pipeline',
    lines: [
      'Graph and Workbench views share one pipeline from connect through publish.',
      'Run Premortem AI executes specialist swarm lanes in parallel.'
    ],
    metrics: [
      { label: 'Steps', value: '6' },
      { label: 'View', value: 'Workbench' },
      { label: 'Status', value: 'Running' }
    ],
    progress: 41,
    log: 'workflow · run premortem ai · dual-lane swarm',
    screenshot: {
      src: '/landing/demo/10.png',
      alt: 'Premortem Workflow Canvas with Run Premortem AI step active'
    }
  },
  {
    id: 'swarm',
    stepId: 'run',
    phase: '02 · Audit',
    headline: 'Specialist swarm orchestration across lenses',
    lines: [
      'Repository and runtime lenses run topology, CI, trust-boundary, and release agents.',
      'Swarm action feed streams agent telemetry as findings cluster.'
    ],
    metrics: [
      { label: 'Lanes', value: '2' },
      { label: 'Agents', value: '24' },
      { label: 'Findings', value: '11' }
    ],
    progress: 50,
    log: 'swarm · repo_topology_agent · release_safety_agent completed',
    screenshot: {
      src: '/landing/demo/4.png',
      alt: 'Premortem Audits Swarm Orchestration Plan with agent lanes'
    }
  },
  {
    id: 'analysis-run',
    stepId: 'run',
    phase: '02 · Audit',
    headline: 'Code analysis for ad hoc snippets',
    lines: [
      'Paste server-side TypeScript for focused analysis.',
      'Complements full-repo audits from Projects and Workflow Canvas.'
    ],
    metrics: [
      { label: 'Model', value: 'Gemini' },
      { label: 'Mode', value: 'Sandbox' },
      { label: 'Step', value: 'Analyze' }
    ],
    progress: 58,
    log: 'analysis · gemini trace · analyzing code structure',
    screenshot: {
      src: '/landing/demo/7.png',
    alt: 'Premortem code analysis examining a TypeScript snippet'
    }
  },
  {
    id: 'compliance-summary',
    stepId: 'review',
    phase: '03 · Review',
    headline: 'Compliance summary lists every finding',
    lines: [
      'Summary checklist shows severity, target, risk title, and review status.',
      'Inspect any row to open trace investigations or dismiss false positives.'
    ],
    metrics: [
      { label: 'Open', value: '11' },
      { label: 'Index', value: '30%' },
      { label: 'Tab', value: 'Summary' }
    ],
    progress: 66,
    log: 'audits · compliance summary · 11 open risks',
    screenshot: {
      src: '/landing/demo/5.png',
      alt: 'Premortem Audits Compliance Summary findings table'
    }
  },
  {
    id: 'trace-investigations',
    stepId: 'review',
    phase: '03 · Review',
    headline: 'Trace investigations with source evidence',
    lines: [
      'Security trace inspection links graph nodes to issue candidates.',
      'GitLab issue synthesis desk prepares structured publish payloads.'
    ],
    metrics: [
      { label: 'Severity', value: 'Medium' },
      { label: 'Status', value: 'Open' },
      { label: 'Sync', value: 'Ready' }
    ],
    progress: 75,
    log: 'trace · issue candidate · gitlab sync ready',
    screenshot: {
      src: '/landing/demo/3.png',
      alt: 'Premortem Audits Trace Investigations with source code evidence'
    }
  },
  {
    id: 'publish',
    stepId: 'review',
    phase: '03 · Review',
    headline: 'Approve and create the GitLab issue',
    lines: [
      'Edit success conditions and rationale before publish.',
      'Approved items land on GitLab with premortem labels and reconciliation.'
    ],
    metrics: [
      { label: 'Action', value: 'Publish' },
      { label: 'Target', value: 'GitLab' },
      { label: 'State', value: 'Staged' }
    ],
    progress: 83,
    log: 'review · approve · gitlab issue package staged',
    screenshot: {
      src: '/landing/demo/9.png',
      alt: 'Premortem reviewer console approve and create GitLab issue'
    }
  },
  {
    id: 'analysis-review',
    stepId: 'review',
    phase: '03 · Review',
    headline: 'Sandbox findings with hotfix guidance',
    lines: [
      'Playground surfaces critical SQL injection and logging risks with patches.',
      'Useful for quick traces before opening a full audit run.'
    ],
    metrics: [
      { label: 'Score', value: '40%' },
      { label: 'Severity', value: 'Critical' },
      { label: 'Category', value: 'SQL' }
    ],
    progress: 91,
    log: 'analysis · sql injection · resolution guideline ready',
    screenshot: {
      src: '/landing/demo/8.png',
    alt: 'Premortem code analysis vulnerability findings and suggested patch'
    }
  },
  {
    id: 'history',
    stepId: 'review',
    phase: '03 · Review',
    headline: 'Audit history compares milestones over time',
    lines: [
      'Compliance index timeline plots successive scanner sweeps.',
      'Compare two audit runs to see resolved and newly introduced risks.'
    ],
    metrics: [
      { label: 'Timeline', value: 'Live' },
      { label: 'Compare', value: 'A/B' },
      { label: 'Export', value: 'CSV' }
    ],
    progress: 100,
    log: 'history · milestone compare · compliance index 43%',
    screenshot: {
      src: '/landing/demo/6.png',
      alt: 'Premortem Audit History and Comparison timeline graph'
    }
  }
] as const;

export const marketingDemoStepStartIndex: Record<MarketingDemoStepId, number> = {
  connect: 0,
  run: 3,
  review: 7
};
