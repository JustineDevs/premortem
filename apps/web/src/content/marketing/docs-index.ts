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

/** Diátaxis + SaaS lifecycle IA: navigate by user intent, not dashboard mirrors. */
export const docsNavSections: readonly DocSection[] = [
  {
    title: 'Getting started',
    items: [
      {
        href: marketingLinks.docs,
        label: 'Documentation hub',
        description: 'Choose the right doc type for your goal.'
      },
      {
        href: marketingLinks.docsGettingStarted,
        label: 'Local setup',
        description: 'Install, configure env vars, and run pnpm dev.'
      },
      {
        href: marketingLinks.docsTutorialFirstAudit,
        label: 'Tutorial: first audit',
        description: 'Learning-oriented path from connect to review-ready issues.'
      }
    ]
  },
  {
    title: 'Guides',
    items: [
      {
        href: marketingLinks.docsGuidesConnectGitlab,
        label: 'Connect GitLab',
        description: 'OAuth, repo selection, and provider tokens.'
      },
      {
        href: marketingLinks.docsGuidesRunAudit,
        label: 'Run an audit',
        description: 'Trigger scans, runtime console, pause/resume checkpoints.'
      },
      {
        href: marketingLinks.docsGuidesReviewPublish,
        label: 'Review & publish',
        description: 'Approve issue candidates and sync to GitLab.'
      },
      {
        href: marketingLinks.docsIntegrationsGitlab,
        label: 'GitLab integration',
        description: 'MCP context, publish APIs, and reconciliation.'
      }
    ]
  },
  {
    title: 'Reference',
    items: [
      {
        href: marketingLinks.docsReferenceApi,
        label: 'API routes',
        description: 'Audits, workspace, issues, and reconciliation endpoints.'
      },
      {
        href: marketingLinks.docsReferenceEnvironment,
        label: 'Environment variables',
        description: 'DATABASE_URL, provider keys, Stripe, and runtime flags.'
      },
      {
        href: marketingLinks.docsArchitecture,
        label: 'Architecture overview',
        description: 'Stack components and supporting services.'
      }
    ]
  },
  {
    title: 'Concepts',
    items: [
      {
        href: marketingLinks.docsConceptsAuditModel,
        label: 'Audit model',
        description: 'Runs, agents, findings, clusters, and issue candidates.'
      },
      {
        href: marketingLinks.docsConceptsDataFlow,
        label: 'Data flow',
        description: 'Ingestion → graph → swarm → review → publish traceability.'
      },
      {
        href: marketingLinks.docsProductFlows,
        label: 'Product flows',
        description: 'Onboarding, org switching, and lifecycle states.'
      }
    ]
  },
  {
    title: 'Troubleshooting',
    items: [
      {
        href: marketingLinks.docsTroubleshooting,
        label: 'Common issues',
        description: 'Auth, webhooks, failed audits, and publish drift.'
      }
    ]
  },
  {
    title: 'Changelog',
    items: [
      {
        href: marketingLinks.docsReleases,
        label: 'Release notes',
        description: 'v0.1.0 scope, limits, and upgrade steps.'
      },
      {
        href: marketingLinks.releases,
        label: 'Full changelog (GitHub)',
        description: 'Canonical markdown in the repository.'
      }
    ]
  }
] as const;

export const docsHubIntro = {
  lead: 'Find the right answer at the right moment: tutorials to learn, guides to complete tasks, reference for exact fields, and concepts for why the system behaves the way it does.',
  audiences: [
    {
      title: 'Operators & reviewers',
      description: 'Task checklists for connect, audit, approve, and publish without reading API docs.',
      href: marketingLinks.docsGuidesReviewPublish
    },
    {
      title: 'Developers',
      description: 'Versioned API reference, env vars, and architecture for integrations.',
      href: marketingLinks.docsReferenceApi
    },
    {
      title: 'New to Premortem',
      description: 'Start with local setup, then run the first-audit tutorial end to end.',
      href: marketingLinks.docsTutorialFirstAudit
    }
  ],
  diataxis: [
    {
      tag: 'Tutorials',
      title: 'Learn by doing',
      description: 'Step-by-step first success paths: no prior Premortem knowledge required.',
      href: marketingLinks.docsTutorialFirstAudit
    },
    {
      tag: 'Guides',
      title: 'Complete a task',
      description: 'Connect GitLab, run audits, review findings, publish issues.',
      href: marketingLinks.docsGuidesConnectGitlab
    },
    {
      tag: 'Reference',
      title: 'Look up exact details',
      description: 'API routes, env vars, limits, and stack components.',
      href: marketingLinks.docsReferenceEnvironment
    },
    {
      tag: 'Concepts',
      title: 'Understand the model',
      description: 'Audit lifecycle, graph memory, and governed publish workflow.',
      href: marketingLinks.docsConceptsAuditModel
    }
  ]
} as const;

export const docsHubCards = [
  {
    href: marketingLinks.docsGettingStarted,
    title: 'Local setup',
    description: 'Bootstrap the monorepo, configure .env.local, and verify smoke tests.',
    tag: 'Getting started'
  },
  {
    href: marketingLinks.docsTutorialFirstAudit,
    title: 'First audit tutorial',
    description: 'Connect a repo, run the specialist swarm, and reach review-ready issues.',
    tag: 'Tutorial'
  },
  {
    href: marketingLinks.docsGuidesRunAudit,
    title: 'Run an audit',
    description: 'Manual scans, continuous audit lock, runtime console, stop/resume.',
    tag: 'Guide'
  },
  {
    href: marketingLinks.docsGuidesReviewPublish,
    title: 'Review & publish',
    description: 'Human approval gates before GitLab sync and reconciliation.',
    tag: 'Guide'
  },
  {
    href: marketingLinks.docsReferenceApi,
    title: 'API reference',
    description: 'Audits, workspace, issues, reconciliation: copy-ready routes.',
    tag: 'Reference'
  },
  {
    href: marketingLinks.docsTroubleshooting,
    title: 'Troubleshooting',
    description: 'Failed onboarding, auth, webhooks, and publish drift fixes.',
    tag: 'Support'
  }
] as const;

export const gettingStartedDoc = {
  title: 'Local setup',
  lead: 'Run Premortem locally and confirm the reviewer console loads at /app.',
  audience: 'Developers evaluating Premortem or contributing to the monorepo.',
  prerequisites: [
    'Node.js 20+ and pnpm 9.x (see packageManager in package.json).',
    'Supabase/Postgres via DATABASE_URL and DIRECT_URL in .env.local.',
    'Optional: Gemini or Azure OpenAI keys for live LLM audit flows.'
  ],
  expectedResult: 'pnpm dev serves the landing page at /, the console at /app, and the API responds on PREMORTEM_API_PORT.',
  toc: [
    { id: 'prerequisites', label: 'Prerequisites' },
    { id: 'start-stack', label: 'Start the stack' },
    { id: 'verify', label: 'Verify with smoke tests' }
  ],
  sections: [
    {
      id: 'prerequisites',
      heading: 'Prerequisites',
      bullets: [
        'Copy .env.example to .env.local and fill DATABASE_URL, DIRECT_URL, and provider keys.',
        'Run pnpm install at the repository root.',
        'For auth-disabled local dev, set PREMORTEM_AUTH_DISABLED=1.'
      ]
    },
    {
      id: 'start-stack',
      heading: 'Start the stack',
      bullets: [
        'pnpm run dev: syncs Prisma, starts the API runtime, and launches apps/web.',
        'Visit / for marketing, /app for the reviewer console, /docs for this hub.',
        'API default: http://127.0.0.1:18787 · Web default: http://127.0.0.1:13000.'
      ]
    },
    {
      id: 'verify',
      heading: 'Verify with smoke tests',
      bullets: [
        'pnpm run smoke:local checks /health, /, /app, and audit snapshot routes.',
        'pnpm run smoke:onboarding-e2e submits a real audit and confirms persisted findings.'
      ]
    }
  ],
  relatedLinks: [
    { href: marketingLinks.docsTutorialFirstAudit, label: 'Tutorial: first audit' },
    { href: marketingLinks.docsReferenceEnvironment, label: 'Environment variables' }
  ]
} as const;

export const firstAuditTutorialDoc = {
  title: 'Tutorial: first audit',
  lead: 'Complete your first governed audit: from GitLab connect to review-ready issue candidates in /app.',
  audience: 'New operators and engineers onboarding to Premortem.',
  prerequisites: [
    'Local stack running (see Local setup).',
    'A GitLab project you can authorize, or PREMORTEM_INGEST_LOCAL=1 for mock ingest.'
  ],
  expectedResult: 'An audit run with agent telemetry, deduplicated clusters, and issue candidates awaiting reviewer approval.',
  toc: [
    { id: 'connect', label: 'Connect GitLab' },
    { id: 'trigger', label: 'Trigger the audit' },
    { id: 'monitor', label: 'Monitor runtime' },
    { id: 'review', label: 'Review outputs' }
  ],
  sections: [
    {
      id: 'connect',
      heading: 'Connect GitLab',
      bullets: [
        'Open /app → Settings → Integrations.',
        'Authorize GitLab OAuth and register the target repository + branch.',
        'Confirm the project appears on the Dashboard with branch context.'
      ]
    },
    {
      id: 'trigger',
      heading: 'Trigger the audit',
      bullets: [
        'From Dashboard or Projects, click Run scan on the connected project.',
        'The API enqueues an audit job; status moves queued → running.',
        'Continuous audit toggle (sidebar or dashboard): OFF = manual scans only; ON = automatic ~90s rotation when idle.'
      ]
    },
    {
      id: 'monitor',
      heading: 'Monitor runtime',
      bullets: [
        'Operations Runtime on Dashboard shows pipeline steps and agent logs.',
        'Use Stop all to cancel active runs and turn off automatic rotation so you can start scans manually.',
        'Resume continues a individually paused audit from its saved checkpoint (when applicable).',
        'Swarm tab in Audits shows repository vs runtime specialist lanes.'
      ]
    },
    {
      id: 'review',
      heading: 'Review outputs',
      bullets: [
        'Open Audits → select the run → Findings tab.',
        'Confirm, edit, or reject synthesized issue candidates.',
        'Approved items are eligible for GitLab publish (see Review & publish guide).'
      ]
    }
  ],
  relatedLinks: [
    { href: marketingLinks.docsGuidesConnectGitlab, label: 'Guide: Connect GitLab' },
    { href: marketingLinks.docsGuidesRunAudit, label: 'Guide: Run an audit' }
  ]
} as const;

export const connectGitlabGuideDoc = {
  title: 'Connect GitLab',
  lead: 'Link a GitLab repository so Premortem can ingest code, CI config, and publish approved issues.',
  audience: 'Platform engineers and team leads setting up the first integration.',
  prerequisites: ['Organization owner or admin access in Premortem.', 'GitLab OAuth app credentials configured for your environment.'],
  expectedResult: 'A connected project with persisted provider tokens and autoRunOnPush settings when continuous audit is enabled.',
  toc: [
    { id: 'oauth', label: 'Authorize OAuth' },
    { id: 'register', label: 'Register project' },
    { id: 'verify', label: 'Verify ingest' }
  ],
  sections: [
    {
      id: 'oauth',
      heading: 'Authorize OAuth',
      bullets: [
        'Settings → Integrations → Connect GitLab.',
        'Complete OAuth; tokens persist for publish and reconciliation workers.',
        'Re-auth if tokens expire: stale connections show WARNING on the project card.'
      ]
    },
    {
      id: 'register',
      heading: 'Register project',
      bullets: [
        'Projects → Register repository: name, repo URL, branch (usually main).',
        'Optional scan snippet attaches custom context for ad-hoc sandbox scans.',
        'Work item attributes (Settings) control labels applied on publish.'
      ]
    },
    {
      id: 'verify',
      heading: 'Verify ingest',
      bullets: [
        'Trigger a manual scan and confirm ingestion_completed in audit events.',
        'Graph snapshot node/edge counts appear in the audit snapshot.',
        'See GitLab integration doc for MCP and REST publish details.'
      ]
    }
  ],
  relatedLinks: [
    { href: marketingLinks.docsIntegrationsGitlab, label: 'GitLab integration reference' },
    { href: marketingLinks.docsGuidesRunAudit, label: 'Run an audit' }
  ]
} as const;

export const runAuditGuideDoc = {
  title: 'Run an audit',
  lead: 'Start manual or continuous audits and monitor the orchestrator pipeline in real time.',
  audience: 'Operators running day-to-day repository risk scans.',
  prerequisites: ['At least one connected project.', 'Audit quota available on your plan (see Settings → Billing).'],
  expectedResult: 'A completed or paused audit run with findings, clusters, and optional issue candidates.',
  toc: [
    { id: 'manual', label: 'Manual scan' },
    { id: 'continuous', label: 'Continuous audit' },
    { id: 'runtime', label: 'Runtime controls' }
  ],
  sections: [
    {
      id: 'manual',
      heading: 'Manual scan',
      bullets: [
        'Dashboard → Run scan on a project card, or Projects → trigger from the row action.',
        'POST /api/audits with projectId and branch enqueues the same job programmatically.',
        'Poll GET /api/audits/:id for runStatus, agentRuns, and events.'
      ]
    },
    {
      id: 'continuous',
      heading: 'Continuous audit',
      bullets: [
        'Sidebar and dashboard toggles set continuousAuditEnabled for the organization.',
        'When OFF, no automatic audits run: only manual Run scan triggers jobs.',
        'When ON, idle projects rotate on a ~90s cycle; active runs block new auto-scans.',
        'PATCH /api/workspace/runtime updates org metadata and project autoRunOnPush flags.'
      ]
    },
    {
      id: 'runtime',
      heading: 'Runtime controls',
      bullets: [
        'Operations Runtime shows pipeline progress, agent count, and terminal logs.',
        'Stop all: POST /api/workspace/runtime/stop-all disables continuous audit and cancels queued/running/paused runs.',
        'POST /api/audits/:id/pause saves a checkpoint and sets runStatus paused (orchestrator cooperative stop).',
        'POST /api/audits/:id/resume re-enqueues from the last checkpoint phase.'
      ]
    }
  ],
  relatedLinks: [
    { href: marketingLinks.docsConceptsAuditModel, label: 'Audit model' },
    { href: marketingLinks.docsReferenceApi, label: 'API routes' }
  ]
} as const;

export const reviewPublishGuideDoc = {
  title: 'Review & publish',
  lead: 'Approve structured issue candidates in /app before they sync to GitLab: no silent auto-publish.',
  audience: 'Engineering leads and reviewers accountable for production issue quality.',
  prerequisites: ['Completed audit with reviewable issue candidates.', 'GitLab publish credentials and label permissions.'],
  expectedResult: 'Published GitLab issues with Premortem metadata, labels, and reconciliation tracking.',
  toc: [
    { id: 'review', label: 'Review findings' },
    { id: 'edit', label: 'Edit synthesis' },
    { id: 'publish', label: 'Publish to GitLab' },
    { id: 'reconcile', label: 'Reconcile drift' }
  ],
  sections: [
    {
      id: 'review',
      heading: 'Review findings',
      bullets: [
        'Audits → Findings: filter by severity, inspect trace and evidence.',
        'Actions: Confirm, Dismiss, or proceed to synthesis edit mode.',
        'Merged/split findings stay traceable in lineage view.'
      ]
    },
    {
      id: 'edit',
      heading: 'Edit synthesis',
      bullets: [
        'Update title, description, why-it-matters, and recommendation before publish.',
        'Persist edits via the audit issue edit API: versions tracked for auditability.',
        'Validation gates reject malformed candidates before they reach publish.'
      ]
    },
    {
      id: 'publish',
      heading: 'Publish to GitLab',
      bullets: [
        'Approve + Publish creates a GitLab issue with configured labels (work item attributes).',
        'Published URL stored on the issue candidate; syncStatus tracked for reconciliation.',
        'Dry-run locally with PREMORTEM_PUBLISH_DRY_RUN=1 when testing.'
      ]
    },
    {
      id: 'reconcile',
      heading: 'Reconcile drift',
      bullets: [
        'Dashboard reconciliation events show matched, drifted, or failed sync states.',
        'POST /api/issues/reconcile compares local snapshot vs remote GitLab issue.',
        'Investigate driftFields when title, labels, or state diverge.'
      ]
    }
  ],
  relatedLinks: [
    { href: marketingLinks.docsIntegrationsGitlab, label: 'GitLab integration' },
    { href: marketingLinks.docsTroubleshooting, label: 'Troubleshooting' }
  ]
} as const;

export const apiReferenceDoc = {
  title: 'API routes',
  lead: 'HTTP endpoints exposed by the Premortem API worker: use the same routes from /app BFF proxies locally.',
  audience: 'Developers integrating audits, workspace settings, or issue actions.',
  expectedResult: 'You can trigger audits and read snapshots without opening the UI.',
  toc: [
    { id: 'audits', label: 'Audits' },
    { id: 'workspace', label: 'Workspace' },
    { id: 'issues', label: 'Issues' }
  ],
  sections: [
    {
      id: 'audits',
      heading: 'Audits',
      bullets: [
        'POST /api/audits · submit audit (202 queued). Body: projectId, branch, commitSha?.',
        'GET /api/audits/:id · snapshot with runStatus, agentRuns, findings, graph, events.',
        'POST /api/audits/:id/pause · POST /api/audits/:id/resume · POST /api/audits/:id/cancel.',
        'GET /api/audits?limit=12 · recent runs with reviewable/rejected counts.'
      ]
    },
    {
      id: 'workspace',
      heading: 'Workspace',
      bullets: [
        'GET /api/workspace · org, billing, usage, runtime, integrations bundle.',
        'PATCH /api/workspace/runtime · continuousAuditEnabled boolean (OFF = no automatic audits).',
        'POST /api/workspace/runtime/stop-all · disable continuous audit and cancel active runs.',
        'PATCH /api/workspace/llm · /work-item-attributes · /policies · /notifications.',
        'POST /api/projects · register repository resource.'
      ]
    },
    {
      id: 'issues',
      heading: 'Issues',
      bullets: [
        'POST /api/issues/:id/approve · /reject · /edit · /publish.',
        'POST /api/issues/reconcile · org-wide reconciliation sweep.',
        'GET /api/reconciliation · recent drift/match events.'
      ]
    }
  ],
  relatedLinks: [
    { href: marketingLinks.docsReferenceEnvironment, label: 'Environment variables' },
    { href: marketingLinks.documentationReadme, label: 'Repository README' }
  ]
} as const;

export const environmentReferenceDoc = {
  title: 'Environment variables',
  lead: 'Required and optional configuration for local dev, smoke tests, and provider integrations.',
  audience: 'Developers deploying or debugging the stack.',
  toc: [
    { id: 'core', label: 'Core' },
    { id: 'providers', label: 'Providers' },
    { id: 'runtime-flags', label: 'Runtime flags' }
  ],
  sections: [
    {
      id: 'core',
      heading: 'Core',
      bullets: [
        'DATABASE_URL · DIRECT_URL: Postgres (Supabase pooler + direct).',
        'PREMORTEM_API_PORT (default 18787) · PREMORTEM_WEB_PORT (default 13000).',
        'PREMORTEM_AUTH_DISABLED=1: bypass auth for local smoke and BFF tests.'
      ]
    },
    {
      id: 'providers',
      heading: 'Providers',
      bullets: [
        'GEMINI_API_KEY or Azure OpenAI vars for live LLM execution.',
        'GITLAB_* OAuth and token vars for connect/publish flows.',
        'GITHUB_TOKEN: GitHub publish path when provider is github.',
        'STRIPE_*: billing checkout (optional locally).'
      ]
    },
    {
      id: 'runtime-flags',
      heading: 'Runtime flags',
      bullets: [
        'PREMORTEM_INGEST_LOCAL=1: mock repository ingest without live GitLab.',
        'PREMORTEM_EXECUTOR=mock: deterministic specialist outputs in smoke tests.',
        'PREMORTEM_PUBLISH_DRY_RUN=1: skip real GitLab issue creation.'
      ]
    }
  ],
  relatedLinks: [{ href: marketingLinks.docsGettingStarted, label: 'Local setup' }]
} as const;

export const auditModelConceptDoc = {
  title: 'Audit model',
  lead: 'Premortem treats an audit as a governed pipeline, not a single LLM call, with persisted artifacts at every stage.',
  audience: 'Anyone who needs to understand run states, checkpoints, and review gates.',
  toc: [
    { id: 'runs', label: 'Audit runs' },
    { id: 'agents', label: 'Agent swarm' },
    { id: 'artifacts', label: 'Artifacts' }
  ],
  sections: [
    {
      id: 'runs',
      heading: 'Audit runs',
      bullets: [
        'runStatus: queued → running → paused | completed | failed | cancelled.',
        'Checkpoints stored in summary.checkpoint: phase, completedSpecialists, counts.',
        'Pause/resume is cooperative: orchestrator saves state between pipeline stages.'
      ]
    },
    {
      id: 'agents',
      heading: 'Agent swarm',
      bullets: [
        'Specialist agents run sequentially with per-agent persistence.',
        'finding_synthesizer_agent merges clusters into issue candidates.',
        'issue_validator_agent enforces schema before review queue admission.'
      ]
    },
    {
      id: 'artifacts',
      heading: 'Artifacts',
      bullets: [
        'Findings → dedupe clusters → issue candidates → published issues.',
        'Graph snapshots capture repo/CI topology for cross-agent context.',
        'Lineage links prompt → finding → cluster → candidate → GitLab issue.'
      ]
    }
  ],
  relatedLinks: [
    { href: marketingLinks.docsConceptsDataFlow, label: 'Data flow' },
    { href: marketingLinks.docsGuidesRunAudit, label: 'Run an audit' }
  ]
} as const;

export const dataFlowConceptDoc = {
  title: 'Data flow',
  lead: 'Trace how repository context becomes reviewable, publishable GitLab issues with full auditability.',
  audience: 'Architects and senior engineers evaluating trust boundaries.',
  toc: [
    { id: 'ingest', label: 'Ingestion' },
    { id: 'analyze', label: 'Analysis' },
    { id: 'govern', label: 'Governance' }
  ],
  sections: [
    {
      id: 'ingest',
      heading: 'Ingestion',
      bullets: [
        'Provider APIs supply repo tree, CI config, and branch metadata.',
        'Graph builder materializes nodes/edges; snapshot stored with optional R2 ref.',
        'Events: audit.ingestion_completed, audit.graph_built.'
      ]
    },
    {
      id: 'analyze',
      heading: 'Analysis',
      bullets: [
        'Specialists consume shared graph payload in parallel lanes (repo vs runtime).',
        'Findings cluster by category/asset; synthesizer produces issue candidates.',
        'Rejected candidates persist as artifacts with validation errors.'
      ]
    },
    {
      id: 'govern',
      heading: 'Governance',
      bullets: [
        'Human review in /app before publish: no bypass from agent output to GitLab.',
        'Work item attributes automation applies labels/metadata on publish.',
        'Reconciliation detects drift between local snapshot and remote issue.'
      ]
    }
  ],
  relatedLinks: [{ href: marketingLinks.docsArchitecture, label: 'Architecture overview' }]
} as const;

export const troubleshootingDoc = {
  title: 'Common issues',
  lead: 'Fast fixes for onboarding blockers, failed audits, auth errors, and publish drift.',
  audience: 'Operators and developers unblocking production or local environments.',
  toc: [
    { id: 'onboarding', label: 'Onboarding' },
    { id: 'audits', label: 'Audits' },
    { id: 'publish', label: 'Publish & sync' }
  ],
  sections: [
    {
      id: 'onboarding',
      heading: 'Onboarding',
      bullets: [
        '502 on /api/*: confirm API is running on PREMORTEM_API_PORT and web BFF can reach it.',
        '401 in /app: set PREMORTEM_AUTH_DISABLED=1 locally or complete Supabase auth.',
        'Empty projects list: run ensureLocalDevelopmentFixture or register via POST /api/projects.'
      ]
    },
    {
      id: 'audits',
      heading: 'Audits',
      bullets: [
        'Audit stuck queued: check AUDIT_QUEUE / local-server executeAuditJob logs.',
        'Pause does not stop immediately: in-flight agent completes; next checkpoint honors paused.',
        'Resume fails without checkpoint: pause once to persist summary.checkpoint.',
        'Entitlement 403: audit or repo quota exceeded; upgrade plan or archive projects.'
      ]
    },
    {
      id: 'publish',
      heading: 'Publish & sync',
      bullets: [
        'Publish 502: verify GitLab token scopes and project access.',
        'Missing labels: enable work item attributes + ensureProjectLabels in Settings.',
        'Reconciliation drift: compare driftFields; re-publish or edit GitLab issue manually.',
        'Stripe checkout fails locally: expected with placeholder price IDs; use plan patch for dev.'
      ]
    }
  ],
  relatedLinks: [
    { href: marketingLinks.docsGettingStarted, label: 'Local setup' },
    { href: marketingLinks.app, label: 'Open /app' }
  ]
} as const;

export const productFlowsDoc = {
  title: 'Product flows',
  lead: 'Lifecycle flows for onboarding, collaboration, and traceability across the Premortem console.',
  audience: 'Product and engineering leads mapping operator journeys.',
  bullets: [
    'Onboarding and personal org creation',
    'Org switching and invitations',
    'Connect provider and provider re-auth',
    'Repo selection and branch selection',
    'Audit history browsing and stale-state handling',
    'Issue review diffs and version compare',
    'Publish confirmation and notification delivery',
    'Traceability view from prompt → finding → cluster → issue → published issue'
  ],
  relatedLinks: [{ href: marketingLinks.docsConceptsDataFlow, label: 'Data flow' }]
} as const;

export const architectureDoc = {
  title: 'Architecture overview',
  lead: 'Core services and planned supporting infrastructure for Premortem v0.1.0.',
  audience: 'Engineers integrating with or extending the platform.',
  toc: [
    { id: 'core', label: 'Core stack' },
    { id: 'supporting', label: 'Supporting services' }
  ],
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
  ],
  relatedLinks: [
    { href: marketingLinks.docsReferenceApi, label: 'API routes' },
    { href: marketingLinks.docsConceptsDataFlow, label: 'Data flow' }
  ]
} as const;

export const gitlabIntegrationDoc = {
  title: 'GitLab integration',
  lead: 'Connect GitLab for repository context, CI pipeline data, and governed issue publishing.',
  audience: 'Developers configuring OAuth, MCP, and publish workflows.',
  toc: [
    { id: 'provides', label: 'What GitLab provides' },
    { id: 'mcp', label: 'MCP and API' },
    { id: 'reviewer', label: 'Reviewer path' }
  ],
  sections: [
    {
      id: 'provides',
      heading: 'What GitLab provides',
      body: 'Repository files, merge request context, CI pipeline configuration, and issue APIs for structured publish and reconciliation workflows.'
    },
    {
      id: 'mcp',
      heading: 'MCP and API',
      body: 'Premortem uses GitLab MCP for agent context and REST APIs for publish flows. See the official GitLab MCP documentation for server setup and scopes.',
      externalHref: 'https://docs.gitlab.com/user/gitlab_duo/model_context_protocol/'
    },
    {
      id: 'reviewer',
      heading: 'Reviewer path',
      body: 'After an audit completes, reviewers approve issue candidates in /app before sync. Publish confirmation and reconciliation keep GitLab issues aligned with audit output.'
    }
  ],
  relatedLinks: [{ href: marketingLinks.docsGuidesConnectGitlab, label: 'Guide: Connect GitLab' }]
} as const;

export const releasesDoc = {
  title: 'Release notes',
  lead: 'Premortem v0.1.0 establishes the GitLab-first foundation for predictive repository audits.',
  description: 'Premortem v0.1.0: GitLab-first foundation for predictive repository audits.',
  summary:
    'Structured issue synthesis, dedupe clustering, review-ready issue candidates, publish/reconcile starters, and runtime pause/resume checkpoints.',
  toc: [
    { id: 'summary', label: 'Summary' },
    { id: 'included', label: 'Included' },
    { id: 'limits', label: 'Known limits' },
    { id: 'upgrade', label: 'Upgrade notes' }
  ],
  included: [
    'Agent registry, policies, specialist prompts, and strict Zod validation.',
    'Prisma persistence, Supabase schema, and RLS/auth migration starters.',
    'LLM adapter seams for Gemini and Azure OpenAI.',
    'Neo4j driver-backed graph snapshot write path.',
    'GitLab publish and reconciliation worker starters.',
    'Queueing, idempotency, leasing, checkpoint pause/resume, and enterprise scaffolding.'
  ],
  limits: [
    'Several systems are scaffold-level rather than fully production-hardened.',
    'Queue workers, notifications, and dashboard flows still need runnable implementation depth.',
    'GitHub parity and enterprise auth are not part of this release baseline.'
  ],
  upgradeNotes: [
    'Apply Supabase migrations in order (including RunStatus paused enum).',
    'Rebuild generated Prisma client after schema changes.',
    'Set all required provider environment variables before publish or graph flows.'
  ],
  relatedLinks: [{ href: marketingLinks.releases, label: 'Full changelog on GitHub' }]
} as const;

/** Reusable doc page renderer input shape */
export type StructuredDoc = {
  title: string;
  lead: string;
  audience?: string;
  prerequisites?: readonly string[];
  expectedResult?: string;
  toc?: readonly { id: string; label: string }[];
  sections?: readonly {
    id: string;
    heading: string;
    bullets?: readonly string[];
    body?: string;
    externalHref?: string;
  }[];
  bullets?: readonly string[];
  relatedLinks?: readonly DocNavItem[];
};
