/** Public pricing aligned with PLAN_LIMITS + Settings billing UI. Demo/marketing only. */
export const marketingPricingTiers = [
  {
    id: 'free',
    name: 'Free',
    priceMonthly: 0,
    priceAnnual: 0,
    description: 'Evaluate Premortem on a single repository.',
    limits: ['1 connected repo', '10 audits / month', 'Reviewer console'],
    features: ['Multi-lens mock audits', 'Structured issue candidates', 'No GitLab publish'],
    cta: 'Start free',
    ctaHref: '/signup',
    highlighted: false
  },
  {
    id: 'pro',
    name: 'Starter',
    priceMonthly: 49,
    priceAnnual: 39,
    description: 'For teams shipping weekly with GitLab publish.',
    limits: ['10 connected repos', '100 audits / month', 'GitLab publish + reconcile'],
    features: ['Parallel specialist swarm', 'Workflow canvas trace', 'Stripe billing'],
    cta: 'Upgrade to Starter',
    ctaHref: '/signup?mode=signup',
    highlighted: false
  },
  {
    id: 'team',
    name: 'Growth',
    priceMonthly: 249,
    priceAnnual: 199,
    description: 'Higher volume audits across many repositories.',
    limits: ['50 connected repos', '500 audits / month', 'Priority reconciliation'],
    features: ['Everything in Starter', 'Team usage dashboards', 'Webhook alerts'],
    cta: 'Upgrade to Growth',
    ctaHref: '/signup?mode=signup',
    highlighted: true
  },
  {
    id: 'enterprise',
    name: 'Enterprise',
    priceMonthly: null,
    priceAnnual: null,
    description: 'SSO, custom quotas, and dedicated support.',
    limits: ['Unlimited repos (contract)', 'Custom audit quotas', 'Entra ID SSO (soon)'],
    features: ['Dedicated success', 'Custom retention', 'Private deployment options'],
    cta: 'Contact sales',
    ctaHref: 'mailto:justinedevs@jstn.site',
    highlighted: false
  }
] as const;

export type MarketingDemoStepId = 'connect' | 'run' | 'review';

export const marketingDemoSequence = [
  {
    stepId: 'connect' as MarketingDemoStepId,
    phase: '01 · Connect',
    headline: 'Authorize GitLab and bind a project',
    lines: [
      'OAuth completes via Supabase: repo tree and CI config ingest next.',
      'Provider tokens persist for publish and reconciliation workers.'
    ],
    metrics: [
      { label: 'Provider', value: 'GitLab' },
      { label: 'Branch', value: 'main' },
      { label: 'Status', value: 'Linked' }
    ],
    progress: 100,
    log: 'meta-architect · CI pipeline detected'
  },
  {
    stepId: 'run' as MarketingDemoStepId,
    phase: '02 · Audit',
    headline: 'Specialist swarm runs in parallel',
    lines: [
      '13 agents analyze topology, CI, trust boundaries, and dependencies.',
      'Findings cluster into deduplicated issue candidates with validation gates.'
    ],
    metrics: [
      { label: 'Agents', value: '13' },
      { label: 'Findings', value: '11' },
      { label: 'Graph nodes', value: '21' }
    ],
    progress: 72,
    log: 'finding_synthesizer_agent · 11 review-ready issues'
  },
  {
    stepId: 'review' as MarketingDemoStepId,
    phase: '03 · Review',
    headline: 'Human approval before GitLab sync',
    lines: [
      'Reviewers confirm, edit, or reject synthesized issues in /app.',
      'Approved items publish to GitLab with reconciliation drift checks.'
    ],
    metrics: [
      { label: 'Approved', value: '8' },
      { label: 'Published', value: '3' },
      { label: 'Drift', value: '0' }
    ],
    progress: 100,
    log: 'gitlab-sync · issue #142 created · premortem label applied'
  }
] as const;

export const solutionsDemoHighlights = [
  {
    personaId: 'engineering',
    title: 'Engineering',
    metric: '11 cross-cutting findings',
    detail: 'Topology + CI risks surfaced before merge.'
  },
  {
    personaId: 'platform',
    title: 'Platform',
    metric: '21 graph nodes',
    detail: 'Pipeline and service edges traced in one audit.'
  },
  {
    personaId: 'security',
    title: 'Security',
    metric: '100% reviewer gate',
    detail: 'Nothing publishes without explicit approval.'
  },
  {
    personaId: 'ai-delivery',
    title: 'AI delivery',
    metric: '13 validated agents',
    detail: 'LLM output passes Zod validation before review.'
  }
] as const;
