import type { ScopeStatus } from './shared';

export const productsPage = {
  title: 'Products',
  description:
    'GitLab-first predictive audit tooling for teams that want structured findings before production breaks.',
  intro:
    'Premortem runs multi-lens repository audits across code, CI, and configuration surfaces, then synthesizes structured issue candidates your team can review before sync.',
  capabilities: [
    'Multi-agent audit orchestration with strict validation and policy gates.',
    'Graph-backed context for code, pipeline, and dependency relationships.',
    'Structured issue synthesis with dedupe clustering and reviewer approval flows.',
    'GitLab publish and reconciliation workflows via MCP and API integrations.'
  ],
  scopeRows: [
    { feature: 'Agent registry, prompts, and Zod validation', status: 'included' as ScopeStatus },
    { feature: 'Prisma + Supabase schema and RLS starters', status: 'included' as ScopeStatus },
    { feature: 'Repo/CI ingestion and graph snapshot runtime', status: 'included' as ScopeStatus },
    { feature: 'Parallel specialist swarm orchestration with real LLM executors', status: 'included' as ScopeStatus },
    { feature: 'Reviewer console at /app backed by runtime API', status: 'included' as ScopeStatus },
    { feature: 'Review approve/reject/publish APIs + CLI', status: 'included' as ScopeStatus },
    { feature: 'Audit detail, lineage, and workflow canvas trace', status: 'included' as ScopeStatus },
    { feature: 'Session middleware on /app (Supabase OAuth)', status: 'included' as ScopeStatus },
    { feature: 'GitHub provider parity', status: 'roadmap' as ScopeStatus },
    { feature: 'Bitbucket provider parity', status: 'roadmap' as ScopeStatus },
    { feature: 'Azure DevOps provider parity', status: 'roadmap' as ScopeStatus },
    { feature: 'Gitea provider parity', status: 'roadmap' as ScopeStatus },
    { feature: 'Enterprise SSO (Entra ID)', status: 'roadmap' as ScopeStatus }
  ] satisfies ReadonlyArray<{ feature: string; status: ScopeStatus }>
} as const;
