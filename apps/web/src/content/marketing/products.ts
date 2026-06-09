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
    { feature: 'Gemini and Azure OpenAI adapter seams', status: 'included' as ScopeStatus },
    { feature: 'Reviewer console at /app', status: 'included' as ScopeStatus },
    { feature: 'Audit detail at /audits/[auditRunId]', status: 'included' as ScopeStatus },
    { feature: 'Queue workers and notification delivery', status: 'scaffold' as ScopeStatus },
    { feature: 'GitHub provider parity', status: 'soon' as ScopeStatus },
    { feature: 'Enterprise SSO (Entra ID)', status: 'soon' as ScopeStatus }
  ] satisfies ReadonlyArray<{ feature: string; status: ScopeStatus }>
} as const;
