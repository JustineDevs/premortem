import { marketingLinks } from '@/lib/marketing-links';

import type { StructuredDoc } from './docs-types';

const GITHUB = 'https://github.com/JustineDevs/premortem/blob/main';

export const deployProductionGuideDoc: StructuredDoc = {
  title: 'Deploy to production',
  lead: 'Deploy Premortem on Cloudflare Pages and Worker with Supabase, Neo4j, and Stripe using the production env wrapper.',
  audience: 'Platform engineers preparing a production cutover.',
  prerequisites: [
    'Cloudflare account with Workers, Pages, and Queues enabled.',
    'Supabase project with migrations applied.',
    'Stripe products and webhook endpoint configured.'
  ],
  expectedResult: 'Marketing and /app on premortem.jstn.site, API on api.jstn.site, verification checks passing.',
  githubSource: `${GITHUB}/docs/releases/DEPLOY-PRODUCTION.md`,
  toc: [
    { id: 'topology', label: 'Runtime topology' },
    { id: 'ci', label: 'CI pipeline' },
    { id: 'api-worker', label: 'API Worker' },
    { id: 'pages', label: 'Cloudflare Pages' },
    { id: 'stripe', label: 'Stripe webhooks' },
    { id: 'verify', label: 'Pre-flight checks' }
  ],
  callouts: [
    {
      variant: 'production',
      text: 'Never set PREMORTEM_AUTH_DISABLED in production. Use Supabase Auth for /app access.'
    }
  ],
  sections: [
    {
      id: 'topology',
      heading: 'Runtime topology',
      bullets: [
        'Web (Next.js BFF, marketing, /app): Cloudflare Pages at premortem.jstn.site.',
        'API (audit orchestration): Cloudflare Worker at api.jstn.site.',
        'Database + Auth: Supabase Postgres pooler and Auth.',
        'Graph: Neo4j Aura or self-hosted Bolt URI.',
        'Billing: Stripe Checkout + webhooks.'
      ]
    },
    {
      id: 'ci',
      heading: 'CI pipeline',
      bullets: ['Push to main runs lint, typecheck, and build via GitHub Actions.'],
      codeBlocks: [
        {
          title: 'CI steps (.github/workflows/ci.yml)',
          language: 'bash',
          code: 'pnpm install\npnpm lint\npnpm typecheck\npnpm build'
        }
      ]
    },
    {
      id: 'api-worker',
      heading: 'API Worker',
      bullets: [
        'Requires CLOUDFLARE_API_TOKEN and CLOUDFLARE_ACCOUNT_ID in GitHub secrets.',
        'The deploy wrapper loads repo-root .env.production and sets CLOUDFLARE_ENV=production before wrangler runs.',
        'Queue bootstrap creates premortem-audit-jobs and premortem-audit-jobs-dlq during deploy when Cloudflare credentials are present.',
        'Set Worker secrets via wrangler (DATABASE_URL, GEMINI_API_KEY, GitLab OAuth, Neo4j, Supabase service role).'
      ],
      codeBlocks: [
        {
          title: 'Manual Worker deploy',
          code: 'pnpm --filter @premortem/api build\ncd apps/api && pnpm run deploy'
        }
      ]
    },
    {
      id: 'pages',
      heading: 'Cloudflare Pages',
      bullets: [
        'Connect GitHub repo; production branch main.',
        'Build: pnpm install --frozen-lockfile && pnpm run build:pages.',
        'The build wrapper loads repo-root .env.production and sets CLOUDFLARE_ENV=production before the Pages build starts.',
        'Set NEXT_PUBLIC_APP_URL=https://premortem.jstn.site and PREMORTEM_API_BASE_URL=https://api.jstn.site.',
        'Include Supabase public keys, Stripe secrets, Sentry/PostHog public keys on Pages.'
      ],
      callouts: [
        {
          variant: 'note',
          text: 'See Environment variables reference for the full production variable list.'
        }
      ]
    },
    {
      id: 'stripe',
      heading: 'Stripe webhooks',
      bullets: [
        'Webhook endpoint: https://premortem.jstn.site/api/stripe/webhook.',
        'Map Starter and Growth price IDs to STRIPE_PRICE_PRO, STRIPE_PRICE_TEAM, and annual variants.',
        'Test mode uses sk_test_*; live mode drives entitlements via webhook events.'
      ]
    },
    {
      id: 'verify',
      heading: 'Pre-flight checks',
      codeBlocks: [
        {
          title: 'Production verification (against live URLs)',
          code: 'PREMORTEM_WEB_BASE=https://premortem.jstn.site \\\nPREMORTEM_API_BASE=https://api.jstn.site \\\npnpm run smoke:production-readiness'
        },
        {
          title: 'Local before push',
          code: 'pnpm run dev\npnpm run smoke:full-app-stress\npnpm run smoke:production-readiness'
        }
      ]
    }
  ],
  relatedLinks: [
    { href: marketingLinks.docsReferenceEnvironment, label: 'Environment variables' },
    { href: marketingLinks.docsReferenceBilling, label: 'Billing & plan limits' },
    { href: marketingLinks.docsGuidesAuthSessions, label: 'Auth & sessions' }
  ]
};

export const workflowCanvasGuideDoc: StructuredDoc = {
  title: 'Workflow Canvas',
  lead: 'Trace the audit pipeline from connect through publish with graph and workbench views.',
  audience: 'Operators who want a visual map of pipeline progress and dual-lane swarm execution.',
  prerequisites: ['At least one connected project.', 'One audit run started or completed.'],
  expectedResult: 'You can read pipeline step status, switch graph/split/workbench modes, and inspect dual-lane agent output.',
  screenshot: {
    src: '/landing/demo/10.png',
    alt: 'Premortem Workflow Canvas with Run Premortem AI step active',
    caption: 'Workflow Canvas: pipeline nodes plus workbench for the active step.'
  },
  toc: [
    { id: 'views', label: 'View modes' },
    { id: 'pipeline', label: 'Pipeline steps' },
    { id: 'workbench', label: 'Workbench' },
    { id: 'controls', label: 'Controls' }
  ],
  sections: [
    {
      id: 'views',
      heading: 'View modes',
      bullets: [
        'Graph: repository topology and pipeline nodes in one canvas.',
        'Split: graph on the left, active step workbench on the right.',
        'Workbench: focus on the selected pipeline step telemetry.'
      ]
    },
    {
      id: 'pipeline',
      heading: 'Pipeline steps',
      bullets: [
        'Connect Provider → Analyze CI & Config → Run Premortem AI → Cluster Risks → Reviewer Approval → Sync GitLab Issues.',
        'Step badges show queued, running, completed, or failed states.',
        'Select a step to load its workbench context.'
      ]
    },
    {
      id: 'workbench',
      heading: 'Workbench',
      bullets: [
        'Dual-lane parallel audit: Repository Graph lane and Pipeline Trace lane.',
        'Agent runs and findings appear as the orchestrator advances.',
        'Run duration and audit step status update in real time during active runs.'
      ]
    },
    {
      id: 'controls',
      heading: 'Controls',
      bullets: [
        'Execute Stream: trigger or resume pipeline execution for the selected project.',
        'Preview layout: view canvas placement without starting a live run.',
        'Reset Layout / Reset View: restore canvas zoom and ELK auto-layout.'
      ]
    }
  ],
  relatedLinks: [
    { href: marketingLinks.docsGuidesRunAudit, label: 'Run an audit' },
    { href: marketingLinks.docsConceptsAuditModel, label: 'Audit model' }
  ]
};

export const auditHistoryGuideDoc: StructuredDoc = {
  title: 'Audit History & Comparison',
  lead: 'Track compliance index over time and compare two audit milestones side by side.',
  audience: 'Engineering leads measuring security posture across releases.',
  prerequisites: ['Multiple completed audit runs in the workspace.'],
  expectedResult: 'You can read the compliance timeline, export CSV, and run A/B milestone comparison.',
  screenshot: {
    src: '/landing/demo/6.png',
    alt: 'Premortem Audit History timeline and comparison engine',
    caption: 'Compliance index timeline plus milestone comparison dropdowns.'
  },
  toc: [
    { id: 'timeline', label: 'Compliance timeline' },
    { id: 'compare', label: 'Milestone comparison' },
    { id: 'log', label: 'Historical log' }
  ],
  sections: [
    {
      id: 'timeline',
      heading: 'Compliance timeline',
      bullets: [
        'Plots compliance rating (0-100) across successive audit runs.',
        'Filter by workspace project via Milestones Filter dropdown.',
        'Export CSV for reporting; continuous checks badge shows when auto-rotation is on.'
      ]
    },
    {
      id: 'compare',
      heading: 'Milestone comparison',
      bullets: [
        'Select baseline audit run (A) and target milestone (B).',
        'Execute Comparative Trace to see score deltas, resolved items, and newly introduced risks.',
        'Use before/after deploy reviews or sprint close-out.'
      ]
    },
    {
      id: 'log',
      heading: 'Historical log',
      bullets: [
        'Complete Historical Audit Log lists reference ID, project, date, index, threats, and inspect link.',
        'Open any row to jump back into Audits & Tracing for that run.'
      ]
    }
  ],
  relatedLinks: [
    { href: marketingLinks.docsGuidesRunAudit, label: 'Run an audit' },
    { href: marketingLinks.docsGuidesReviewPublish, label: 'Review & publish' }
  ]
};

export const aiPlaygroundGuideDoc: StructuredDoc = {
  title: 'Code analysis',
  lead: 'Run focused code analysis on a TypeScript snippet without a full repository audit.',
  audience: 'Engineers validating a suspicious function or sharing the workflow with stakeholders.',
  prerequisites: ['GEMINI_API_KEY configured for analysis.', 'Optional: use preset snippets for validation.'],
  expectedResult: 'Structured findings with severity, line references, trace nodes, and resolution guidance.',
  screenshot: {
    src: '/landing/demo/8.png',
    alt: 'Premortem code analysis findings with SQL injection detail',
    caption: 'Review findings step with compliance score and resolution guidance.'
  },
  toc: [
    { id: 'workflow', label: 'Analysis flow' },
    { id: 'input', label: 'Source input' },
    { id: 'results', label: 'Results' },
    { id: 'limits', label: 'Scope vs full audit' }
  ],
  sections: [
    {
      id: 'workflow',
      heading: 'Analysis flow',
      bullets: [
        '1. Edit snippet: paste or pick a preset TypeScript buffer.',
        '2. Run analysis: execute the focused analysis path.',
        '3. Review Findings: severity, category, execution path, and patch hints.'
      ]
    },
    {
      id: 'input',
      heading: 'Source input',
      bullets: [
        'Console accepts server-side TypeScript/JSON for focused code analysis.',
        'Preset snippets cover SQL injection and credential logging patterns.',
        'Custom code from Projects can also be analyzed before a full audit trigger.'
      ],
      screenshot: {
        src: '/landing/demo/7.png',
        alt: 'Premortem code analysis reviewing a TypeScript buffer',
        caption: 'Analysis step in progress.'
      }
    },
    {
      id: 'results',
      heading: 'Results',
      bullets: [
        'Compliance index score for the snippet (not whole-repo rating).',
        'Critical/High/Medium findings with line numbers and categories.',
        'Resolution guideline and optional suggested patch.'
      ]
    },
    {
      id: 'limits',
      heading: 'Scope vs full audit',
      bullets: [
        'Focused analysis runs a smaller analysis path, not the full 13-agent swarm.',
        'No GitLab publish from code analysis: use Audits & Tracing for governed issue sync.',
        'Full audits include graph ingest, dual lanes, clustering, and reviewer gates.'
      ],
      callouts: [
        {
          variant: 'note',
          text: 'For production risk coverage, always run a full audit from Projects or Dashboard.'
        }
      ]
    }
  ],
  relatedLinks: [
    { href: marketingLinks.docsGuidesRunAudit, label: 'Run an audit' },
    { href: marketingLinks.docsReferenceEnvironment, label: 'Environment variables' }
  ]
};

export const workspaceSettingsGuideDoc: StructuredDoc = {
  title: 'Workspace settings',
  lead: 'Configure profile, organization, integrations, LLM routing, billing, and notifications from Integrations & Scope.',
  audience: 'Workspace admins and platform owners.',
  prerequisites: ['Signed-in Supabase user with org membership.'],
  expectedResult: 'Provider connected, LLM and work item attributes saved, billing tier reflects usage.',
  screenshot: {
    src: '/landing/demo/11.png',
    alt: 'Premortem Connected Providers settings',
    caption: 'Integrations & Scope: GitLab connected with OAuth scopes.'
  },
  toc: [
    { id: 'profile', label: 'Profile & organization' },
    { id: 'integrations', label: 'Integrations & providers' },
    { id: 'llm', label: 'AI model config' },
    { id: 'work-items', label: 'Work item attributes' },
    { id: 'billing', label: 'Billing' },
    { id: 'notifications', label: 'Notifications' }
  ],
  sections: [
    {
      id: 'profile',
      heading: 'Profile & organization',
      bullets: [
        'Profile: display name, username, timezone.',
        'Organization: legal name, billing email, website URL.',
        'Changes persist via PATCH /api/workspace/profile and /organization.'
      ]
    },
    {
      id: 'integrations',
      heading: 'Integrations & providers',
      bullets: [
        'GitLab: OAuth connect, reconnect, sync work item attributes.',
        'GitHub, Bitbucket, Azure DevOps, and Gitea are not available in this release.',
        'Sync integration refreshes metadata tags from provider APIs.'
      ]
    },
    {
      id: 'llm',
      heading: 'LLM configuration',
      bullets: [
        'Default Gemini model, max tokens, temperature.',
        'Vendor routing tiers for fallback providers.',
        'Custom provider hosts for self-hosted endpoints.',
        'PATCH /api/workspace/llm persists configuration.'
      ]
    },
    {
      id: 'work-items',
      heading: 'Work item attributes',
      bullets: [
        'Label templates and metadata applied on GitLab publish.',
        'Maps Premortem severity and category to provider fields.',
        'PATCH /api/workspace/work-item-attributes.'
      ]
    },
    {
      id: 'billing',
      heading: 'Billing',
      bullets: [
        'View plan tier, usage (scans, tokens), and upgrade via Stripe Checkout.',
        'Free tier: local plan patch works without Checkout in local development.',
        'See Billing & plan limits reference for quotas.'
      ]
    },
    {
      id: 'notifications',
      heading: 'Notifications',
      bullets: [
        'Slack webhook and channel for audit completion alerts.',
        'Email alert list with minimum severity threshold.',
        'PATCH /api/workspace/notifications.'
      ]
    }
  ],
  relatedLinks: [
    { href: marketingLinks.docsReferenceBilling, label: 'Billing & plan limits' },
    { href: marketingLinks.docsGuidesConnectGitlab, label: 'Connect GitLab' },
    { href: marketingLinks.products, label: 'Pricing tiers' }
  ]
};

export const authSessionsGuideDoc: StructuredDoc = {
  title: 'Auth & sessions',
  lead: 'Supabase Auth gates /app; GitLab OAuth is separate and used for repository and publish access.',
  audience: 'Developers configuring local auth or debugging login loops.',
  prerequisites: ['NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY set.'],
  expectedResult: 'Users sign in at /login; /app loads workspace data under their Supabase user id.',
  githubSource: `${GITHUB}/docs/security/session-design.md`,
  toc: [
    { id: 'supabase', label: 'Supabase Auth' },
    { id: 'local', label: 'Local dev modes' },
    { id: 'gitlab-oauth', label: 'GitLab OAuth (integration)' },
    { id: 'troubleshoot', label: 'Common auth issues' }
  ],
  sections: [
    {
      id: 'supabase',
      heading: 'Supabase Auth',
      bullets: [
        '/login and /signup use Supabase SSR cookies via apps/web middleware.',
        'When Cloudflare Turnstile is enabled, the widget appears before the OAuth redirect and must succeed before the GitLab handoff continues.',
        'BFF routes read session and map to organization membership.',
        'GET /api/auth/status reports whether auth is configured.'
      ]
    },
    {
      id: 'local',
      heading: 'Local dev modes',
      bullets: [
        'Real auth: set Supabase keys; pnpm run dev uses your Supabase user as profileId.',
        'Local verification mode: PREMORTEM_AUTH_DISABLED=1 with LOCAL_DEV_FIXTURE (verification scripts only).',
        'Never enable PREMORTEM_AUTH_DISABLED in production.'
      ],
      callouts: [
        {
          variant: 'local',
          text: 'Use http://127.0.0.1:13000 consistently for NEXT_PUBLIC_APP_URL in local GitLab OAuth apps.'
        }
      ],
      codeBlocks: [
        {
          title: 'Auth-disabled local verification only',
          code: 'PREMORTEM_AUTH_DISABLED=1\nPREMORTEM_SMOKE_USE_FIXTURE=1\npnpm run smoke:local'
        }
      ]
    },
    {
      id: 'gitlab-oauth',
      heading: 'GitLab OAuth (integration)',
      bullets: [
        'Distinct from login: authorizes repo read and issue publish scopes.',
        'Redirect URI: {NEXT_PUBLIC_APP_URL}/api/integrations/callback/gitlab.',
        'Connect route: GET /api/integrations/connect/gitlab?next=/app.'
      ],
      callouts: [
        {
          variant: 'warning',
          text: 'Mismatching localhost vs 127.0.0.1 in NEXT_PUBLIC_APP_URL causes OAuth redirect errors and /login loops.'
        }
      ]
    },
    {
      id: 'troubleshoot',
      heading: 'Common auth issues',
      bullets: [
        'ERR_TOO_MANY_REDIRECTS on /login: canonical host redirect; align APP URL and OAuth callback host.',
        '401 on /api/workspace: session expired or auth disabled without local verification credentials.',
        'Callback failure on /login or /signup: Supabase could not exchange the external code for a session, or the callback host did not match NEXT_PUBLIC_APP_URL.',
        'Captcha-config notice on /login or /signup: Turnstile is enabled but NEXT_PUBLIC_TURNSTILE_SITE_KEY or TURNSTILE_SECRET_KEY is missing in the deployment environment.',
        'Empty /app after login: workspace exists but no projects registered yet (not an auth failure).'
      ]
    }
  ],
  relatedLinks: [
    { href: marketingLinks.docsTroubleshooting, label: 'Troubleshooting' },
    { href: marketingLinks.docsGuidesConnectGitlab, label: 'Connect GitLab' }
  ]
};

export const billingPlansReferenceDoc: StructuredDoc = {
  title: 'Billing & plan limits',
  lead: 'Entitlements enforced by @premortem/db PLAN_LIMITS: repos, monthly audits, and publish capability.',
  audience: 'Admins choosing a tier or debugging 402/403 quota errors.',
  expectedResult: 'You know which features unlock per plan and how usage is counted.',
  toc: [
    { id: 'tiers', label: 'Plan tiers' },
    { id: 'enforcement', label: 'Enforcement' },
    { id: 'stripe', label: 'Stripe integration' },
    { id: 'upgrade', label: 'Upgrade path' }
  ],
  sections: [
    {
      id: 'tiers',
      heading: 'Plan tiers',
      bullets: [
        'Free: 1 repo, 10 audits/month, reviewer console, no GitLab publish.',
        'Starter (pro): 10 repos, 100 audits/month, GitLab publish + reconcile.',
        'Growth (team): 50 repos, 500 audits/month, priority reconciliation.',
        'Enterprise: contract quotas, SSO tracked on the roadmap, custom deployment.'
      ],
      codeBlocks: [
        {
          title: 'Canonical limits (packages/db/src/entitlements.ts)',
          language: 'text',
          code: 'free:       1 repo,   10 audits/mo,  publish: false\npro:       10 repos, 100 audits/mo, publish: true\nteam:      50 repos, 500 audits/mo, publish: true\nenterprise: contract quotas,           publish: true'
        }
      ]
    },
    {
      id: 'enforcement',
      heading: 'Enforcement',
      bullets: [
        'assertCanRegisterProject: 403 repo_limit when at maxRepos.',
        'assertCanRunAudit: 402 quota_exceeded when auditsUsed >= auditLimit.',
        'assertCanPublish: 403 feature_locked on Free tier.',
        'Usage visible in Settings → Billing and GET /api/workspace.'
      ]
    },
    {
      id: 'stripe',
      heading: 'Stripe integration',
      bullets: [
        'Checkout: POST /api/billing/checkout with plan and billing cycle.',
        'Webhook: POST /api/stripe/webhook updates OrganizationBillingAccount.',
        'Env: STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET, STRIPE_PRICE_* for each tier.',
        'Test mode: plan PATCH in Settings works without Checkout when Stripe is not configured.'
      ],
      callouts: [
        {
          variant: 'local',
          text: 'Stripe checkout requires configured test or live price IDs; local development can still use Settings plan patch.'
        }
      ]
    },
    {
      id: 'upgrade',
      heading: 'Upgrade path',
      bullets: [
        'Marketing pricing: /products mirrors tier copy.',
        'In-app: Settings → Billing → Upgrade opens Stripe Checkout when configured.',
        'After webhook, auditQuotaMonthly and plan update immediately.'
      ]
    }
  ],
  relatedLinks: [
    { href: marketingLinks.products, label: 'Pricing page' },
    { href: marketingLinks.docsGuidesWorkspaceSettings, label: 'Workspace settings' },
    { href: marketingLinks.docsGuidesDeployProduction, label: 'Deploy to production' }
  ]
};

export const neo4jGraphReferenceDoc: StructuredDoc = {
  title: 'Neo4j & graph store',
  lead: 'Repository topology and risk context persist as graph snapshots alongside Postgres audit records.',
  audience: 'Developers running local Neo4j or connecting Neo4j Aura in production.',
  githubSource: `${GITHUB}/docs/architecture/graph-strategy.md`,
  toc: [
    { id: 'local', label: 'Local setup' },
    { id: 'env', label: 'Environment variables' },
    { id: 'runtime', label: 'Runtime behavior' },
    { id: 'disable', label: 'Disable graph' }
  ],
  sections: [
    {
      id: 'local',
      heading: 'Local setup',
      bullets: [
        'pnpm run docker:up starts Neo4j and Postgres via docker-compose.yml.',
        'Default Bolt: bolt://localhost:7687, user neo4j, password from compose file.',
        'Graph writes occur during audit ingest when NEO4J_URI is reachable.'
      ],
      codeBlocks: [
        {
          title: 'Start local graph + Postgres',
          code: 'pnpm run docker:up'
        }
      ],
      callouts: [
        {
          variant: 'local',
          text: 'Set NEO4J_DISABLED=1 to skip graph writes when Neo4j is unavailable (audits still run).'
        }
      ]
    },
    {
      id: 'env',
      heading: 'Environment variables',
      bullets: [
        'NEO4J_URI: Bolt connection string (Aura or local).',
        'NEO4J_USERNAME, NEO4J_PASSWORD: credentials.',
        'NEO4J_DISABLED=1: skip graph persistence (local development fallback).'
      ]
    },
    {
      id: 'runtime',
      heading: 'Runtime behavior',
      bullets: [
        'Ingest builds nodes/edges for repo tree and CI topology.',
        'GET /api/audits/:id/graph returns snapshot for Workflow Canvas.',
        'Specialist agents consume graph payload in swarm lanes.'
      ]
    },
    {
      id: 'disable',
      heading: 'Disable graph',
      bullets: [
        'When Neo4j is down, set NEO4J_DISABLED=1 to avoid connection errors.',
        'Audits complete without graph artifact; canvas graph panel shows awaiting state.',
        'Production: use Neo4j Aura or managed Bolt with secrets in Worker/Pages env.'
      ]
    }
  ],
  relatedLinks: [
    { href: marketingLinks.docsConceptsDataFlow, label: 'Data flow' },
    { href: marketingLinks.docsReferenceEnvironment, label: 'Environment variables' }
  ]
};

export const observabilityReferenceDoc: StructuredDoc = {
  title: 'Observability',
  lead: 'Sentry, PostHog, Langfuse, and Phoenix hooks for errors, product analytics, and LLM traces.',
  audience: 'Developers enabling production monitoring or local trace debugging.',
  githubSource: `${GITHUB}/docs/architecture/observability.md`,
  toc: [
    { id: 'sentry', label: 'Sentry' },
    { id: 'posthog', label: 'PostHog' },
    { id: 'llm-traces', label: 'LLM traces' },
    { id: 'verify', label: 'Verify stack' }
  ],
  sections: [
    {
      id: 'sentry',
      heading: 'Sentry',
      bullets: [
        'NEXT_PUBLIC_SENTRY_DSN and SENTRY_DSN for client and server.',
        'SENTRY_TRACES_SAMPLE_RATE controls performance sampling (default 0.1).',
        'Configured in apps/web/sentry.*.config.ts and instrumentation.'
      ]
    },
    {
      id: 'posthog',
      heading: 'PostHog',
      bullets: [
        'NEXT_PUBLIC_POSTHOG_KEY and NEXT_PUBLIC_POSTHOG_HOST for product analytics.',
        'POSTHOG_API_KEY for server-side capture when needed.',
        'Events wired via packages/observability and canonical hooks.'
      ]
    },
    {
      id: 'llm-traces',
      heading: 'LLM traces',
      bullets: [
        'Langfuse: LANGFUSE_PUBLIC_KEY, LANGFUSE_SECRET_KEY, LANGFUSE_BASE_URL.',
        'Phoenix/Arize: PHOENIX_* vars for OpenInference tracing and evals.',
        'PHOENIX_LLM_EVAL=1 runs judge evals after completed audits (requires GEMINI_API_KEY).'
      ]
    },
    {
      id: 'verify',
      heading: 'Verify stack',
      codeBlocks: [
        {
          title: 'Canonical SDK readiness',
          code: 'node scripts/canonical/verify-stack.mjs'
        }
      ]
    }
  ],
  relatedLinks: [
    { href: marketingLinks.docsReferenceEnvironment, label: 'Environment variables' },
    { href: marketingLinks.docsGuidesDeployProduction, label: 'Deploy to production' }
  ]
};

export const securityConceptDoc: StructuredDoc = {
  title: 'Security & trust boundaries',
  lead: 'Human review gates publish; provider tokens are scoped; multi-tenant data stays organization-bound.',
  audience: 'Security reviewers and architects evaluating Premortem deployment.',
  githubSource: `${GITHUB}/docs/security/session-design.md`,
  toc: [
    { id: 'boundaries', label: 'Trust boundaries' },
    { id: 'publish', label: 'Publish gate' },
    { id: 'tokens', label: 'Provider tokens' },
    { id: 'tenant', label: 'Multi-tenant isolation' },
    { id: 'deep-dives', label: 'Repository deep dives' }
  ],
  sections: [
    {
      id: 'boundaries',
      heading: 'Trust boundaries',
      bullets: [
        'Marketing and /app: public vs authenticated Supabase session.',
        'BFF (/api/* on web): proxies to API worker with session context.',
        'API worker: orchestration layer with no direct browser access to secrets.',
        'GitLab: OAuth scopes limit repo and issue API access.'
      ]
    },
    {
      id: 'publish',
      heading: 'Publish gate',
      bullets: [
        'Agents produce issue candidates, not live GitLab issues.',
        'Reviewer must approve in /app before POST publish executes.',
        'Consensus validation and clustering suppress low-signal worker noise before the review queue sees it.',
        'PREMORTEM_PUBLISH_DRY_RUN=1 skips remote issue creation in dev.'
      ]
    },
    {
      id: 'tokens',
      heading: 'Provider tokens',
      bullets: [
        'GitLab OAuth tokens stored encrypted at rest in Postgres.',
        'GITLAB_TOKEN (PAT) for ingest/publish in server env, never exposed to client.',
        'Stripe secrets only on server routes and webhooks.'
      ]
    },
    {
      id: 'tenant',
      heading: 'Multi-tenant isolation',
      bullets: [
        'Organizations own projects, audits, and billing accounts.',
        'API routes scope queries by organizationId from session.',
        'Supabase RLS migrations provide defense-in-depth for direct DB access.'
      ]
    },
    {
      id: 'deep-dives',
      heading: 'Repository deep dives',
      bullets: [
        'Session design: docs/security/session-design.md',
        'Public vs private docs policy: docs/security/public-vs-private-docs.md',
        'ADR 0001 canonical architecture: docs/architecture/adr-0001-canonical-product-and-system-design.md',
        'Queue runbook: docs/runbooks/queueing.md'
      ],
      externalHref: `${GITHUB}/docs/security/session-design.md`
    }
  ],
  relatedLinks: [
    { href: marketingLinks.docsGuidesAuthSessions, label: 'Auth & sessions' },
    { href: marketingLinks.docsConceptsDataFlow, label: 'Data flow' },
    { href: marketingLinks.docsArchitectureEnterpriseReadiness, label: 'Enterprise readiness' },
    { href: marketingLinks.privacy, label: 'Privacy policy' }
  ]
};

export const enterpriseReadinessDoc: StructuredDoc = {
  title: 'Enterprise readiness',
  lead: 'A production-safe operating model for data handling, worker isolation, review gating, and tenant boundaries across the supported integration surfaces.',
  audience: 'Security reviewers, platform teams, and procurement stakeholders.',
  prerequisites: ['A configured workspace or a sandbox environment.'],
  expectedResult:
    'You can explain what data is processed, what is persisted, how tenants are separated, which providers are live today, and how the system refuses weak or under-evidenced output.',
  githubSource: `${GITHUB}/docs/architecture/enterprise-readiness.md`,
  toc: [
    { id: 'developer-tests', label: 'Developer tests' },
    { id: 'gateway', label: 'Data gateway' },
    { id: 'ai-flow', label: 'AI privacy' },
    { id: 'isolation', label: 'Tenant isolation' },
    { id: 'integrations', label: 'Provider support matrix' },
    { id: 'controls', label: 'Operational controls' },
    { id: 'compliance', label: 'Compliance evidence' },
    { id: 'faq', label: 'FAQ / security defensibility' },
    { id: 'deployment', label: 'Deployment modes' }
  ],
  callouts: [
    {
      variant: 'warning',
      text: 'GitLab repository connect, publish, and reconcile are shipped today. GitHub repository integration, Bitbucket, Azure DevOps, and Gitea remain roadmap surfaces in this release.'
    },
    {
      variant: 'note',
      text:
        'If you need a zero data retention LLM contract, choose a provider plan that explicitly guarantees it. Premortem can route and validate requests, but provider policy still matters.'
    }
  ],
  sections: [
    {
      id: 'developer-tests',
      heading: 'Developer tests',
      bullets: [
        "Don't Waste My Time: findings must be concrete, structural, and code-specific.",
        'Context Boundary: findings must be grounded in the repository, not guessed from a short prompt alone.',
        'Workflow Disruption: the review loop must stay inside the existing git workflow, terminal commands, and repo-native evals.',
        'If the system cannot point at a real file, route, config key, graph edge, or CI artifact, it should return no finding instead of generic advice.'
      ]
    },
    {
      id: 'gateway',
      heading: 'Data gateway',
      bullets: [
        'Repository content is consumed by background workers and reduced into structured findings, clusters, issue candidates, and audit snapshots.',
        'The reviewer console persists operational artifacts, not a copy of the repository tree.',
        'Provider tokens remain server-side and are scoped to the integration needed for the task.'
      ]
    },
    {
      id: 'ai-flow',
      heading: 'AI privacy',
      bullets: [
        'Prompts are shaped by a workflow contract that rejects generic output and refuses weak evidence.',
        'Consensus validation drops low-confidence worker noise before it reaches reviewer queues.',
        'Output scrubbing removes sensitive strings from generated text before persistence or publish.'
      ]
    },
    {
      id: 'isolation',
      heading: 'Tenant isolation',
      bullets: [
        'Organization-scoped queries, Supabase RLS, and server-side session context separate workspace data.',
        'Webhook handlers validate inbound signatures before they can enqueue work.',
        'The worker boundary is designed so one tenant cannot read another tenant’s audit state.'
      ]
    },
    {
      id: 'integrations',
      heading: 'Provider support matrix',
      bullets: [
        'GitLab: supported for connect, ingest, publish, and reconciliation.',
        'GitHub: sign-in and auth primitives exist; repository integration is roadmap.',
        'Bitbucket: roadmap.',
        'Azure DevOps: roadmap.',
        'Gitea: roadmap.'
      ]
    },
    {
      id: 'controls',
      heading: 'Operational controls',
      bullets: [
        'Audit runs are logged with actor, organization, timestamps, and workflow state.',
        'Review gates prevent direct agent-to-provider publish.',
        'Dedicated stop and resume controls make background runs observable and reversible.'
      ]
    },
    {
      id: 'compliance',
      heading: 'Compliance evidence',
      bullets: [
        'Audit trails should capture who triggered the run, which workspace it used, and what was approved.',
        'The system is structured to support SOC 2 style evidence collection through immutable run records and reconciliation history.',
        'Exportable audit history and workspace settings make security review evidence easier to assemble.'
      ]
    },
    {
      id: 'faq',
      heading: 'FAQ / security defensibility',
      body:
        '**What data is stored?** Operational artifacts such as audit runs, findings, issue candidates, and reconciliation records. The reviewer console is not a mirrored copy of the repository tree.\n\n' +
        '**How does the system avoid noisy output?** Worker lanes are filtered through a consensus validator. Candidates that lack concrete repository evidence, fail the confidence threshold, or look generic are rejected before they reach the review queue.\n\n' +
        '**How is prompt injection handled?** Prompt payloads are sanitized before they reach the LLM layer, and generated text is scrubbed before persistence or publish.\n\n' +
        '**Which providers are production-supported today?** GitLab is supported for connect, ingest, publish, and reconciliation. GitHub, Bitbucket, Azure DevOps, and Gitea remain roadmap surfaces until they are shipped and documented.\n\n' +
        '**Can teams run this in their own environment?** SaaS is the default. Private-cloud or BYOK deployment is treated as a separate delivery track and must be documented and validated on its own terms.'
    },
    {
      id: 'deployment',
      heading: 'Deployment modes',
      bullets: [
        'SaaS is the default operational mode.',
        'The web, API, orchestrator, database, and graph layers are separated so a private-cloud deployment can be reasoned about cleanly.',
        'Self-hosted or BYOK packaging is a separate delivery track and should be documented before any enterprise commitment.'
      ]
    }
  ],
  relatedLinks: [
    { href: marketingLinks.docsConceptsSecurity, label: 'Security & trust' },
    { href: marketingLinks.docsReferenceObservability, label: 'Observability' },
    { href: marketingLinks.docsGuidesDeployProduction, label: 'Deploy to production' }
  ]
};

export const publishGitlabTutorialDoc: StructuredDoc = {
  title: 'Tutorial: publish to GitLab',
  lead: 'Take one approved issue candidate from review to a live GitLab issue with labels and reconciliation.',
  audience: 'Reviewers completing their first publish workflow.',
  prerequisites: [
    'Starter plan or above (publish enabled).',
    'Completed audit with open issue candidates.',
    'GitLab integration connected with issue create permission.'
  ],
  expectedResult: 'GitLab issue URL stored on candidate; reconciliation shows matched status.',
  screenshot: {
    src: '/landing/demo/9.png',
    alt: 'Approve and create GitLab issue in reviewer console',
    caption: 'GitLab Issue Synthesis Desk with Approve & Create GitLab Issue.'
  },
  toc: [
    { id: 'open', label: 'Open findings' },
    { id: 'edit', label: 'Edit synthesis' },
    { id: 'approve', label: 'Approve & publish' },
    { id: 'verify', label: 'Verify reconciliation' }
  ],
  sections: [
    {
      id: 'open',
      heading: 'Open findings',
      bullets: [
        'Audits & Tracing → select run → Trace Investigations or Compliance Summary.',
        'Pick an OPEN issue candidate with GitLab Sync Ready badge.',
        'Inspect source evidence and trace flow before editing.'
      ]
    },
    {
      id: 'edit',
      heading: 'Edit synthesis',
      bullets: [
        'Update success conditions, why-it-matters, and recommendation text.',
        'Save Synthesis to Runtime persists edits with version history.',
        'Merge or split overlapping findings if needed before publish.'
      ]
    },
    {
      id: 'approve',
      heading: 'Approve & publish',
      bullets: [
        'Click Approve & Create GitLab Issue.',
        'Work item attributes apply configured labels on create.',
        'Dry-run locally: PREMORTEM_PUBLISH_DRY_RUN=1 logs payload without remote create.'
      ],
      callouts: [
        {
          variant: 'production',
          text: 'Free tier returns feature_locked until upgraded to Starter.'
        }
      ]
    },
    {
      id: 'verify',
      heading: 'Verify reconciliation',
      bullets: [
        'Published URL appears on the issue candidate row.',
        'GET /api/reconciliation or Dashboard events show matched vs drifted.',
        'POST /api/issues/reconcile sweeps org-wide drift after bulk publish.'
      ]
    }
  ],
  relatedLinks: [
    { href: marketingLinks.docsGuidesReviewPublish, label: 'Review & publish guide' },
    { href: marketingLinks.docsReferenceBilling, label: 'Billing & plan limits' }
  ]
};
