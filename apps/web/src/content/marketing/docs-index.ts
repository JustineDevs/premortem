import { marketingLinks } from '@/lib/marketing-links';

export type DocNavItem = {
  href: string;
  label: string;
  description?: string;
};

export type DocSection = {
  title: string;
  items: readonly DocNavItem[];
};

export const docsNavSections: readonly DocSection[] = [
  {
    title: 'Start',
    items: [
      {
        href: marketingLinks.docs,
        label: 'Documentation hub',
        description: 'Overview of Premortem docs and quick links.'
      },
      {
        href: marketingLinks.docsGettingStarted,
        label: 'Getting started',
        description: 'Install, configure, and run the local stack.'
      }
    ]
  },
  {
    title: 'Product',
    items: [
      {
        href: marketingLinks.docsProductFlows,
        label: 'Product flows',
        description: 'Onboarding, review, publish, and traceability paths.'
      },
      {
        href: marketingLinks.docsArchitecture,
        label: 'Architecture',
        description: 'Core stack, graph layer, and ecosystem integrations.'
      },
      {
        href: marketingLinks.docsIntegrationsGitlab,
        label: 'GitLab integration',
        description: 'Connect repos, MCP, and issue publish workflows.'
      }
    ]
  },
  {
    title: 'Release',
    items: [
      {
        href: marketingLinks.docsReleases,
        label: 'Release notes',
        description: 'v0.1.0 scope, limits, and upgrade notes.'
      },
      {
        href: marketingLinks.releases,
        label: 'Full release notes (GitHub)',
        description: 'Canonical markdown in the repository.'
      }
    ]
  },
  {
    title: 'External',
    items: [
      {
        href: marketingLinks.documentationReadme,
        label: 'Repository README',
        description: 'Contributor-oriented project overview on GitHub.'
      }
    ]
  }
] as const;

export const docsHubCards = [
  {
    href: marketingLinks.docsGettingStarted,
    title: 'Getting started',
    description: 'Bootstrap the monorepo, run pnpm dev, and verify smoke tests.',
    tag: 'Setup'
  },
  {
    href: marketingLinks.docsProductFlows,
    title: 'Product flows',
    description: 'Onboarding, repo connection, review diffs, and publish confirmation.',
    tag: 'Product'
  },
  {
    href: marketingLinks.docsArchitecture,
    title: 'Architecture',
    description: 'Supabase, Prisma, Cloudflare Workers, GitLab, Gemini, and Neo4j.',
    tag: 'Engineering'
  },
  {
    href: marketingLinks.docsIntegrationsGitlab,
    title: 'GitLab integration',
    description: 'OAuth, MCP context, CI data, and structured issue publishing.',
    tag: 'Integrations'
  },
  {
    href: marketingLinks.docsReleases,
    title: 'Releases',
    description: 'What shipped in v0.1.0 and known scaffold limits.',
    tag: 'Release'
  },
  {
    href: marketingLinks.howItWorks,
    title: 'How it works',
    description: 'Three-step flow from connect to review-ready issues.',
    tag: 'Overview'
  }
] as const;

export const gettingStartedDoc = {
  title: 'Getting started',
  description: 'Run Premortem locally and verify the core routes.',
  sections: [
    {
      heading: 'Prerequisites',
      bullets: [
        'Node.js and pnpm 9.x (see repo packageManager field).',
        'Supabase/Postgres connection via DATABASE_URL in .env.local.',
        'Provider keys for Gemini or Azure OpenAI when running audit flows.'
      ]
    },
    {
      heading: 'Start the stack',
      bullets: [
        'pnpm run dev: syncs Prisma, starts the API runtime, and launches apps/web.',
        'Visit / for the landing page, /app for the reviewer console.',
        'Open /audits/[auditRunId] after submitting an audit through the local API.'
      ]
    },
    {
      heading: 'Verify with smoke tests',
      bullets: [
        'pnpm run smoke:local checks /health, /, /app, and /audits/[auditRunId].',
        'Submits a real audit through the local API and confirms persisted findings.'
      ]
    }
  ]
} as const;

export const productFlowsDoc = {
  title: 'Product flows',
  description: 'Flows planned or in progress for the GitLab-first product surface.',
  bullets: [
    'Onboarding and personal org creation',
    'Org switching and invitations',
    'Connect provider and provider re-auth',
    'Repo selection and branch selection',
    'Audit history browsing and stale-state handling',
    'Issue review diffs and version compare',
    'Publish confirmation and notification delivery',
    'Traceability view from prompt → finding → cluster → issue → published issue'
  ]
} as const;

export const architectureDoc = {
  title: 'Architecture',
  description: 'Core stack and supporting services for Premortem v0.1.0.',
  coreStack: [
    'Supabase / Postgres for product data, auth-adjacent storage, and RLS-oriented multi-tenant ownership.',
    'Prisma for application data access and typed repositories.',
    'Cloudflare Workers via Wrangler for API edge entrypoints.',
    'GitLab as the primary issue publishing and repository provider.',
    'MCP Toolbox for Databases for safe SQL-oriented agent database access.',
    'Gemini as the default LLM path, with Azure OpenAI as the enterprise alternative.',
    'Neo4j as the graph persistence layer for repository structure and risk context.'
  ],
  supportingNext: [
    'Cloudflare Queues for async audit fan-out.',
    'Cloudflare R2 for graph snapshot exports and evidence bundles.',
    'Upstash Redis or Valkey for idempotency and short-lived orchestration state.',
    'OpenTelemetry + Grafana/Tempo/Loki for traces, logs, and metrics.',
    'Microsoft Entra ID if enterprise SSO becomes required.'
  ]
} as const;

export const gitlabIntegrationDoc = {
  title: 'GitLab integration',
  description: 'Connect GitLab for repository context, CI pipeline data, and issue publishing.',
  sections: [
    {
      heading: 'What GitLab provides',
      body: 'Repository files, merge request context, CI pipeline configuration, and issue APIs for structured publish and reconciliation workflows.'
    },
    {
      heading: 'MCP and API',
      body: 'Premortem uses GitLab MCP for agent context and REST APIs for publish flows. See the official GitLab MCP documentation for server setup and scopes.',
      externalHref: 'https://docs.gitlab.com/user/gitlab_duo/model_context_protocol/'
    },
    {
      heading: 'Reviewer path',
      body: 'After an audit completes, reviewers approve issue candidates in /app before sync. Publish confirmation and reconciliation keep GitLab issues aligned with audit output.'
    }
  ]
} as const;

export const releasesDoc = {
  title: 'Release notes',
  description: 'Premortem v0.1.0: GitLab-first foundation for predictive repository audits.',
  summary:
    'Establishes structured issue synthesis, dedupe clustering, review-ready issue candidates, and publish/reconcile workflow starters.',
  included: [
    'Agent registry, policies, real specialist prompts, and strict Zod validation.',
    'Prisma persistence, Supabase starter schema, and RLS/auth migration starters.',
    'LLM adapter seams for Gemini and Azure OpenAI.',
    'Neo4j driver-backed graph snapshot write path.',
    'GitLab publish and reconciliation worker starters.',
    'Queueing, idempotency, leasing, dead-letter, and enterprise-readiness scaffolding.'
  ],
  limits: [
    'Several systems are scaffold-level rather than fully production-hardened.',
    'Queue workers, notifications, and dashboard flows still need runnable implementation depth.',
    'GitHub parity and enterprise auth are not part of this release baseline.'
  ],
  upgradeNotes: [
    'Apply Supabase migrations in order.',
    'Rebuild generated Prisma client after schema changes.',
    'Set all required provider environment variables before attempting publish or graph flows.'
  ]
} as const;
