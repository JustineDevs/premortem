import {
  makeFindingTestCase,
  repoRootPath
} from './shared-fixtures.mjs';

const promptCases = [
  {
    description: "Don't Waste My Time: finding synthesizer returns an empty envelope when no grounded critical risk exists",
    promptPath: '.agents/prompts/finding-synthesizer.md',
    expectedCategories: [],
    expectedAgent: 'finding_synthesizer_agent',
    canonicalFindings: [],
    dedupeClusters: [],
    expectRefusal: true
  },
  {
    description: 'Context Boundary: finding synthesizer stays grounded on release safety rollout failures',
    promptPath: '.agents/prompts/finding-synthesizer.md',
    expectedCategories: ['release_safety'],
    expectedAgent: 'release_safety_agent',
    canonicalFindings: [
      {
        agent: 'release_safety_agent',
        finding_id: 'finding-release-001',
        category: 'release_safety',
        finding_type: 'unsafe_deploy_sequence',
        severity: 'high',
        confidence: 0.92,
        predicted_failure: {
          summary: 'Deploying the API before the schema migration can break reviewer routes with missing columns.',
          failure_mode: 'Application queries fields before the migration is applied.',
          trigger_conditions: [
            'API deployment starts before migration job completion.',
            'Reviewer console requests the new audit fields during rollout.'
          ],
          blast_radius: 'Reviewer console, audit detail read model, publish flow'
        },
        why_it_matters: 'Rollout order becomes a production outage instead of a controlled migration.',
        affected_assets: ['apps/api/src/routes/audits.ts', 'packages/db/prisma/schema.prisma'],
        evidence: [
          {
            kind: 'code',
            ref: 'apps/api/src/routes/audits.ts:1',
            reason: 'Audit routes depend on fields introduced by the new schema branch.'
          },
          {
            kind: 'schema',
            ref: 'packages/db/prisma/schema.prisma:1',
            reason: 'Schema adds required fields without a documented rollout sequence.'
          }
        ],
        recommended_controls: [
          'Gate API rollout on successful migration completion.',
          'Add rollback-safe feature gating for the new audit fields.'
        ],
        dedupe_keys: ['release:migration-order', 'api:schema-readiness'],
        tags: ['deploy', 'migration']
      }
    ],
    dedupeClusters: [
      {
        cluster_id: 'cluster-release-guard',
        root_cause: 'Schema-dependent rollout is missing a migration gate and health signal.',
        finding_ids: ['finding-release-001'],
        remediation_surface: 'deployment pipeline and rollout readiness checks'
      }
    ]
  },
  {
    description: 'Context Boundary: database migration safety prompt stays grounded on schema rollout hazards',
    promptPath: '.agents/prompts/db-migration-safety.md',
    expectedCategories: ['release_safety'],
    expectedAgent: 'db_migration_safety_agent',
    canonicalFindings: [
      {
        agent: 'db_migration_safety_agent',
        finding_id: 'finding-db-001',
        category: 'release_safety',
        finding_type: 'backward_incompatible_migration',
        severity: 'high',
        confidence: 0.91,
        predicted_failure: {
          summary: 'A required schema field lands before every read path is updated.',
          failure_mode: 'Old code keeps querying the table while the migration changes the contract.',
          trigger_conditions: [
            'Migration is deployed without a compatibility window.',
            'Read paths still expect the old column set.'
          ],
          blast_radius: 'Audit reads, project settings, and reviewer console'
        },
        why_it_matters: 'Backward-incompatible migrations can break production reads and writes.',
        affected_assets: ['packages/db/prisma/schema.prisma', 'apps/api/src/routes/projects.ts'],
        evidence: [
          {
            kind: 'schema',
            ref: 'packages/db/prisma/schema.prisma:1',
            reason: 'The schema is the source of truth for persisted fields.'
          },
          {
            kind: 'code',
            ref: 'apps/api/src/routes/projects.ts:1',
            reason: 'Project routes depend on the persistence contract.'
          }
        ],
        recommended_controls: [
          'Ship the migration behind a compatibility flag.',
          'Add a rollback test for the old query path.'
        ],
        dedupe_keys: ['migration:compatibility', 'schema:read-path'],
        tags: ['migration', 'compatibility']
      }
    ],
    dedupeClusters: [
      {
        cluster_id: 'cluster-db-migration',
        root_cause: 'Schema changes can outpace the app rollout.',
        finding_ids: ['finding-db-001'],
        remediation_surface: 'database migrations and rollout sequencing'
      }
    ]
  },
  {
    description: 'Workflow Disruption: observability recovery prompt keeps recovery guidance tied to trace and alert paths',
    promptPath: '.agents/prompts/observability-recovery.md',
    expectedCategories: ['observability_recovery'],
    expectedAgent: 'observability_recovery_agent',
    canonicalFindings: [
      {
        agent: 'observability_recovery_agent',
        finding_id: 'finding-obs-001',
        category: 'observability_recovery',
        finding_type: 'missing_recovery_signal',
        severity: 'high',
        confidence: 0.88,
        predicted_failure: {
          summary: 'A failing rollout does not emit a recovery signal when the health path stays green.',
          failure_mode: 'Operators only see the break after user traffic starts failing.',
          trigger_conditions: [
            'Health checks remain green during a bad schema rollout.',
            'No alert is emitted for failed audit reads.'
          ],
          blast_radius: 'Operations, reviewer console, and publish flow'
        },
        why_it_matters: 'Without a recovery signal, rollback decisions arrive too late.',
        affected_assets: ['packages/observability/src/sentry.ts', 'apps/api/src/local-server.ts'],
        evidence: [
          {
            kind: 'code',
            ref: 'packages/observability/src/sentry.ts:1',
            reason: 'Sentry exists as a recovery surface for failed runtime paths.'
          },
          {
            kind: 'code',
            ref: 'apps/api/src/local-server.ts:1',
            reason: 'The health path should prove schema readiness.'
          }
        ],
        recommended_controls: [
          'Emit a rollout readiness event after schema-dependent reads pass.',
          'Alert on failed audit-read probes during release.'
        ],
        dedupe_keys: ['observability:recovery', 'rollout:health-signal'],
        tags: ['observability', 'release']
      }
    ],
    dedupeClusters: [
      {
        cluster_id: 'cluster-observability',
        root_cause: 'Release health lacks a recovery event.',
        finding_ids: ['finding-obs-001'],
        remediation_surface: 'trace emission and alerting'
      }
    ]
  },
  {
    description: 'Context Boundary: onboarding operability prompt stays grounded on profile and workspace bootstrap',
    promptPath: '.agents/prompts/onboarding-operability.md',
    expectedCategories: ['onboarding_operability'],
    expectedAgent: 'onboarding_operability_agent',
    canonicalFindings: [
      {
        agent: 'onboarding_operability_agent',
        finding_id: 'finding-onboard-001',
        category: 'onboarding_operability',
        finding_type: 'missing_completion_state',
        severity: 'medium',
        confidence: 0.9,
        predicted_failure: {
          summary: 'A user reaches the app without any durable completion marker for onboarding.',
          failure_mode: 'The UI cannot tell if setup finished or should continue prompting.',
          trigger_conditions: [
            'Profile bootstrap completes but no completion flag is written.',
            'The app reloads and has no state to resume from.'
          ],
          blast_radius: 'Signup flow, personal workspace bootstrap, and home screen'
        },
        why_it_matters: 'Onboarding can never transition cleanly into the normal product flow.',
        affected_assets: ['apps/web/app/api/workspace/profile/route.ts', 'packages/db/src/workspace.ts'],
        evidence: [
          {
            kind: 'code',
            ref: 'apps/web/app/api/workspace/profile/route.ts:1',
            reason: 'Profile updates are the right place to persist onboarding completion.'
          },
          {
            kind: 'code',
            ref: 'packages/db/src/workspace.ts:1',
            reason: 'Workspace state already contains the canonical profile and billing data.'
          }
        ],
        recommended_controls: [
          'Persist onboarding completion after the final setup step.',
          'Gate the welcome tour on the durable profile flag.'
        ],
        dedupe_keys: ['onboarding:completion-state', 'workspace:bootstrap'],
        tags: ['onboarding', 'product']
      }
    ],
    dedupeClusters: [
      {
        cluster_id: 'cluster-onboarding',
        root_cause: 'Onboarding lacks a durable completion marker.',
        finding_ids: ['finding-onboard-001'],
        remediation_surface: 'profile persistence and UI gating'
      }
    ]
  },
  {
    description: 'Context Boundary: integration boundary prompt keeps provider and webhook surfaces distinct',
    promptPath: '.agents/prompts/integration-boundary.md',
    expectedCategories: ['integration_boundary'],
    expectedAgent: 'integration_boundary_agent',
    canonicalFindings: [
      {
        agent: 'integration_boundary_agent',
        finding_id: 'finding-integration-001',
        category: 'integration_boundary',
        finding_type: 'cross_boundary_trust',
        severity: 'high',
        confidence: 0.87,
        predicted_failure: {
          summary: 'An integration route trusts caller state instead of the integration boundary.',
          failure_mode: 'Provider-specific permissions bleed into unrelated actions.',
          trigger_conditions: [
            'Webhook handling reuses a caller context that was never re-validated.',
            'Integration state is mutated without a boundary check.'
          ],
          blast_radius: 'GitLab integration, Nango sessions, and workspace connections'
        },
        why_it_matters: 'Broken integration boundaries allow one provider to influence another.',
        affected_assets: ['apps/web/app/api/workspace/integrations/route.ts', 'apps/web/app/api/workspace/integrations/nango-session/route.ts'],
        evidence: [
          {
            kind: 'code',
            ref: 'apps/web/app/api/workspace/integrations/route.ts:1',
            reason: 'Integration writes belong at the trust boundary.'
          },
          {
            kind: 'code',
            ref: 'apps/web/app/api/workspace/integrations/nango-session/route.ts:1',
            reason: 'Session creation crosses from app state into provider auth.'
          }
        ],
        recommended_controls: [
          'Separate provider session creation from workspace mutation.',
          'Validate each integration action at the server boundary.'
        ],
        dedupe_keys: ['integration:boundary', 'provider:trust-scope'],
        tags: ['integration', 'boundary']
      }
    ],
    dedupeClusters: [
      {
        cluster_id: 'cluster-integration',
        root_cause: 'Provider auth and workspace mutation are too close together.',
        finding_ids: ['finding-integration-001'],
        remediation_surface: 'integration routes and session issuance'
      }
    ]
  },
  {
    description: 'Cross-repo boundary prompt keeps multi-repository coupling explicit',
    promptPath: '.agents/prompts/cross-repo-boundary.md',
    expectedCategories: ['cross_repo_boundary'],
    expectedAgent: 'cross_repo_boundary_agent',
    canonicalFindings: [
      {
        agent: 'cross_repo_boundary_agent',
        finding_id: 'finding-crossrepo-001',
        category: 'cross_repo_boundary',
        finding_type: 'shared_state_leak',
        severity: 'high',
        confidence: 0.89,
        predicted_failure: {
          summary: 'A shared boundary file leaks assumptions across unrelated repositories.',
          failure_mode: 'One repo changes the contract and another repo silently depends on it.',
          trigger_conditions: [
            'The same shared data source is used by more than one repo boundary.',
            'A change lands without a repo-specific compatibility check.'
          ],
          blast_radius: 'Repository graph, cross-repo audit context, and publish workflow'
        },
        why_it_matters: 'Cross-repo leakage makes isolated changes unsafe.',
        affected_assets: ['packages/db/src/workspace.ts', 'packages/integrations/src/neo4j-graph-store.ts'],
        evidence: [
          {
            kind: 'code',
            ref: 'packages/db/src/workspace.ts:1',
            reason: 'Workspace data is shared across multiple product surfaces.'
          },
          {
            kind: 'code',
            ref: 'packages/integrations/src/neo4j-graph-store.ts:1',
            reason: 'Graph persistence bridges repository boundaries.'
          }
        ],
        recommended_controls: [
          'Introduce a repo-specific contract check before sharing state.',
          'Pin cross-repo dependencies to explicit boundary interfaces.'
        ],
        dedupe_keys: ['cross-repo:boundary', 'shared-state:leak'],
        tags: ['repo', 'boundary']
      }
    ],
    dedupeClusters: [
      {
        cluster_id: 'cluster-crossrepo',
        root_cause: 'Shared state crosses repository boundaries.',
        finding_ids: ['finding-crossrepo-001'],
        remediation_surface: 'workspace contract and graph persistence'
      }
    ]
  },
  {
    description: 'API deprecation risk prompt keeps route compatibility claims anchored',
    promptPath: '.agents/prompts/api-deprecation-risk.md',
    expectedCategories: ['api_deprecation'],
    expectedAgent: 'api_deprecation_risk_agent',
    canonicalFindings: [
      {
        agent: 'api_deprecation_risk_agent',
        finding_id: 'finding-api-001',
        category: 'api_deprecation',
        finding_type: 'compatibility_break',
        severity: 'medium',
        confidence: 0.85,
        predicted_failure: {
          summary: 'A deprecated route shape survives in one caller while the new route shape lands elsewhere.',
          failure_mode: 'Client and server disagree on the request body contract.',
          trigger_conditions: [
            'A route body is changed without a compatibility shim.',
            'An older caller still sends the prior payload shape.'
          ],
          blast_radius: 'Audit submission, workspace settings, and issue actions'
        },
        why_it_matters: 'Deprecation without a transition plan breaks existing clients.',
        affected_assets: ['apps/api/src/routes/audits.ts', 'apps/web/app/api/audits/run/route.ts'],
        evidence: [
          {
            kind: 'code',
            ref: 'apps/api/src/routes/audits.ts:1',
            reason: 'The API route is a compatibility boundary for audit submission.'
          },
          {
            kind: 'code',
            ref: 'apps/web/app/api/audits/run/route.ts:1',
            reason: 'The BFF wrapper forwards audit submission payloads.'
          }
        ],
        recommended_controls: [
          'Ship a compatibility layer before changing the payload contract.',
          'Add a regression test for both old and new request shapes.'
        ],
        dedupe_keys: ['api:deprecation', 'request:compatibility'],
        tags: ['api', 'deprecation']
      }
    ],
    dedupeClusters: [
      {
        cluster_id: 'cluster-api-deprecation',
        root_cause: 'Route shapes change before all callers are updated.',
        finding_ids: ['finding-api-001'],
        remediation_surface: 'API body validation and compatibility shims'
      }
    ]
  },
  {
    description: 'Orchestrator analysis prompt keeps queue and scheduler risks concrete',
    promptPath: '.agents/prompts/orchestrator-analysis.md',
    expectedCategories: ['orchestrator_analysis'],
    expectedAgent: 'orchestrator_analysis_agent',
    canonicalFindings: [
      {
        agent: 'orchestrator_analysis_agent',
        finding_id: 'finding-orchestrator-001',
        category: 'orchestrator_analysis',
        finding_type: 'sequential_bottleneck',
        severity: 'high',
        confidence: 0.9,
        predicted_failure: {
          summary: 'A long-running worker lane serializes a batch that should be parallelized.',
          failure_mode: 'The orchestrator waits on one specialist before the next can start.',
          trigger_conditions: [
            'A batch loop processes specialist agents sequentially.',
            'The queue grows while one lane is still waiting.'
          ],
          blast_radius: 'Audit run latency, queue depth, and reviewer throughput'
        },
        why_it_matters: 'Sequential orchestration inflates runtime and hides partial failures.',
        affected_assets: ['services/orchestrator/src/scheduler/run-audit.ts', 'services/orchestrator/src/executors/llm-executors.ts'],
        evidence: [
          {
            kind: 'code',
            ref: 'services/orchestrator/src/scheduler/run-audit.ts:1',
            reason: 'Scheduler code owns specialist execution order.'
          },
          {
            kind: 'code',
            ref: 'services/orchestrator/src/executors/llm-executors.ts:1',
            reason: 'Executor behavior determines how each specialist call runs.'
          }
        ],
        recommended_controls: [
          'Run independent specialists in parallel with bounded concurrency.',
          'Surface partial failures instead of waiting for a whole batch to finish.'
        ],
        dedupe_keys: ['orchestrator:sequential-batch', 'specialist:latency'],
        tags: ['orchestrator', 'queue']
      }
    ],
    dedupeClusters: [
      {
        cluster_id: 'cluster-orchestrator',
        root_cause: 'Specialist orchestration is too serial.',
        finding_ids: ['finding-orchestrator-001'],
        remediation_surface: 'scheduler batch execution'
      }
    ]
  },
  {
    description: 'Trust boundary prompt keeps privilege scope tied to auth flow',
    promptPath: '.agents/prompts/trust-boundary.md',
    expectedCategories: ['trust_boundary'],
    expectedAgent: 'trust_boundary_agent',
    canonicalFindings: [
      {
        agent: 'trust_boundary_agent',
        finding_id: 'finding-trust-001',
        category: 'trust_boundary',
        finding_type: 'over_privileged_path',
        severity: 'high',
        confidence: 0.93,
        predicted_failure: {
          summary: 'A low-trust caller can cross into a privileged publish or admin path.',
          failure_mode: 'The caller inherits permissions that should have stayed server-side.',
          trigger_conditions: [
            'The route trusts client state instead of server state.',
            'A publish or mutation path lacks a role check.'
          ],
          blast_radius: 'Publishing, billing, and workspace mutation'
        },
        why_it_matters: 'Trust boundaries define who can mutate production state.',
        affected_assets: ['apps/web/middleware.ts', 'apps/api/src/lib/request-context.ts'],
        evidence: [
          {
            kind: 'code',
            ref: 'apps/web/middleware.ts:1',
            reason: 'Middleware is where local trust bypasses should be constrained.'
          },
          {
            kind: 'code',
            ref: 'apps/api/src/lib/request-context.ts:1',
            reason: 'Request context resolution defines who the caller is.'
          }
        ],
        recommended_controls: [
          'Enforce server-side role checks before every privileged action.',
          'Keep trust boundary decisions out of client-provided state.'
        ],
        dedupe_keys: ['trust:boundary', 'privilege:scope'],
        tags: ['auth', 'trust']
      }
    ],
    dedupeClusters: [
      {
        cluster_id: 'cluster-trust',
        root_cause: 'A low-trust caller can cross into a privileged path.',
        finding_ids: ['finding-trust-001'],
        remediation_surface: 'auth middleware and request context'
      }
    ]
  },
  {
    description: 'Issue memory prompt keeps persisted issue state tied to the memory surface',
    promptPath: '.agents/prompts/issue-memory.md',
    expectedCategories: ['issue_memory'],
    expectedAgent: 'issue_memory_agent',
    canonicalFindings: [
      {
        agent: 'issue_memory_agent',
        finding_id: 'finding-memory-001',
        category: 'issue_memory',
        finding_type: 'stale_issue_memory',
        severity: 'medium',
        confidence: 0.86,
        predicted_failure: {
          summary: 'Past issue signals are not persisted in a durable memory surface.',
          failure_mode: 'The agent re-discovers the same issue instead of learning from prior history.',
          trigger_conditions: [
            'Issue state is only remembered in runtime memory.',
            'A later audit run cannot retrieve the prior issue context.'
          ],
          blast_radius: 'Issue deduplication, reviewer efficiency, and clustering'
        },
        why_it_matters: 'A memoryless issue loop creates duplicate reviewer work.',
        affected_assets: ['services/orchestrator/src/executors/default-executors.ts', 'services/orchestrator/src/validation/validate-issues.ts'],
        evidence: [
          {
            kind: 'code',
            ref: 'services/orchestrator/src/executors/default-executors.ts:1',
            reason: 'Issue memory behavior is defined in the executor layer.'
          },
          {
            kind: 'code',
            ref: 'services/orchestrator/src/validation/validate-issues.ts:1',
            reason: 'Issue validation consumes prior issue state during review.'
          }
        ],
        recommended_controls: [
          'Persist issue memory in a durable store.',
          'Use the memory surface during deduplication and validation.'
        ],
        dedupe_keys: ['issue-memory:durable-state', 'dedupe:history'],
        tags: ['memory', 'issues']
      }
    ],
    dedupeClusters: [
      {
        cluster_id: 'cluster-memory',
        root_cause: 'Issue state is not durable enough for repeat audits.',
        finding_ids: ['finding-memory-001'],
        remediation_surface: 'executor state and validation history'
      }
    ]
  },
  {
    description: 'CI regression prompt keeps pipeline drift tied to concrete workflow files',
    promptPath: '.agents/prompts/ci-regression.md',
    expectedCategories: ['ci_regression'],
    expectedAgent: 'ci_regression_agent',
    canonicalFindings: [
      {
        agent: 'ci_regression_agent',
        finding_id: 'finding-ci-001',
        category: 'ci_regression',
        finding_type: 'masked_failure',
        severity: 'high',
        confidence: 0.9,
        predicted_failure: {
          summary: 'A CI job keeps passing because the failure path is hidden behind retries or a stale artifact.',
          failure_mode: 'The pipeline reports success while the underlying regression is still present.',
          trigger_conditions: [
            'A workflow reuses a cache or artifact from another commit.',
            'A retry-dependent stage masks the original failure.'
          ],
          blast_radius: 'GitHub Actions, release gates, and deploy confidence'
        },
        why_it_matters: 'Masked failures are the fastest path to shipping broken code.',
        affected_assets: ['.github/workflows/ci.yml', 'package.json'],
        evidence: [
          {
            kind: 'code',
            ref: '.github/workflows/ci.yml:1',
            reason: 'The workflow defines the stage gates that can hide or reveal regressions.'
          },
          {
            kind: 'code',
            ref: 'package.json:1',
            reason: 'The eval and build scripts define the gate sequence.'
          }
        ],
        recommended_controls: [
          'Fail the pipeline on the first regression signal.',
          'Add regression coverage for the masked failure path.'
        ],
        dedupe_keys: ['ci:masked-failure', 'pipeline:retry-drift'],
        tags: ['ci', 'regression']
      }
    ],
    dedupeClusters: [
      {
        cluster_id: 'cluster-ci',
        root_cause: 'CI hides the first failure.',
        finding_ids: ['finding-ci-001'],
        remediation_surface: 'workflow stages and retry policy'
      }
    ]
  },
  {
    description: 'Secret rotation prompt keeps key lifecycle tied to secret handling paths',
    promptPath: '.agents/prompts/secret-rotation-risk.md',
    expectedCategories: ['secret_rotation'],
    expectedAgent: 'secret_rotation_agent',
    canonicalFindings: [
      {
        agent: 'secret_rotation_agent',
        finding_id: 'finding-secret-001',
        category: 'secret_rotation',
        finding_type: 'stale_secret_lifecycle',
        severity: 'high',
        confidence: 0.91,
        predicted_failure: {
          summary: 'A secret lives long past the point where the app expects it to rotate.',
          failure_mode: 'The old secret continues to authorize privileged calls.',
          trigger_conditions: [
            'Rotation is planned but old credentials remain accepted.',
            'The worker or API still reads from the stale secret source.'
          ],
          blast_radius: 'Auth, webhooks, and secret-backed integrations'
        },
        why_it_matters: 'Stale secrets make rotation meaningless and prolong exposure.',
        affected_assets: ['packages/security/src/secrets.ts', 'packages/security/src/startup.ts'],
        evidence: [
          {
            kind: 'code',
            ref: 'packages/security/src/secrets.ts:1',
            reason: 'Secret lifecycle helpers belong in the security package.'
          },
          {
            kind: 'code',
            ref: 'packages/security/src/startup.ts:1',
            reason: 'Startup checks define which secrets must exist.'
          }
        ],
        recommended_controls: [
          'Rotate secrets with a hard cutover window.',
          'Reject stale secrets once the new secret is live.'
        ],
        dedupe_keys: ['secret:rotation', 'secret:lifecycle'],
        tags: ['security', 'rotation']
      }
    ],
    dedupeClusters: [
      {
        cluster_id: 'cluster-secret-rotation',
        root_cause: 'Secret rotation lacks a hard cutover.',
        finding_ids: ['finding-secret-001'],
        remediation_surface: 'secret store and startup validation'
      }
    ]
  },
  {
    description: 'Supply chain vulnerability prompt keeps dependency risk grounded in lockfile and build paths',
    promptPath: '.agents/prompts/dependency-supply-chain.md',
    expectedCategories: ['dependency_supply_chain'],
    expectedAgent: 'dependency_supply_chain_agent',
    canonicalFindings: [
      {
        agent: 'dependency_supply_chain_agent',
        finding_id: 'finding-supply-001',
        category: 'dependency_supply_chain',
        finding_type: 'untrusted_dependency',
        severity: 'high',
        confidence: 0.9,
        predicted_failure: {
          summary: 'An untrusted package version enters the build without any supply-chain guardrail.',
          failure_mode: 'The build consumes a package that was never pinned or reviewed.',
          trigger_conditions: [
            'The lockfile drifts without scrutiny.',
            'A build job trusts the latest available dependency.'
          ],
          blast_radius: 'Build, runtime, and evaluation tooling'
        },
        why_it_matters: 'Supply-chain drift can compromise every downstream service.',
        affected_assets: ['pnpm-lock.yaml', 'package.json'],
        evidence: [
          {
            kind: 'code',
            ref: 'pnpm-lock.yaml:1',
            reason: 'The lockfile is the source of truth for pinned dependency versions.'
          },
          {
            kind: 'code',
            ref: 'package.json:1',
            reason: 'The workspace dependency graph originates here.'
          }
        ],
        recommended_controls: [
          'Pin and review dependency changes before merge.',
          'Add a supply-chain regression check in CI.'
        ],
        dedupe_keys: ['supply-chain:dependency', 'lockfile:drift'],
        tags: ['supply-chain', 'dependencies']
      }
    ],
    dedupeClusters: [
      {
        cluster_id: 'cluster-supply-chain',
        root_cause: 'Dependency upgrades are not sufficiently guarded.',
        finding_ids: ['finding-supply-001'],
        remediation_surface: 'lockfile review and CI enforcement'
      }
    ]
  },
  {
    description: 'Artifact integrity prompt keeps generated output tied to source-of-truth files',
    promptPath: '.agents/prompts/artifact-integrity.md',
    expectedCategories: ['artifact_integrity'],
    expectedAgent: 'artifact_integrity_agent',
    canonicalFindings: [
      {
        agent: 'artifact_integrity_agent',
        finding_id: 'finding-artifact-001',
        category: 'artifact_integrity',
        finding_type: 'stale_generated_artifact',
        severity: 'medium',
        confidence: 0.88,
        predicted_failure: {
          summary: 'The generated Prisma client can drift from the TypeScript source of truth and ship stale runtime behavior.',
          failure_mode: 'A checked-in generated artifact remains out of sync with the schema or client source.',
          trigger_conditions: [
            'The source file changes without regenerating the committed artifact.',
            'Runtime imports resolve the stale generated file before the fresh source path.'
          ],
          blast_radius: 'Database access, route handlers, and published issue persistence'
        },
        why_it_matters: 'Artifact drift hides contract changes until runtime.',
        affected_assets: ['packages/db/src/client.ts', 'packages/db/src/client.js'],
        evidence: [
          {
            kind: 'file',
            ref: 'packages/db/src/client.ts:1',
            reason: 'The TypeScript client is the source of truth for the generated runtime API.'
          },
          {
            kind: 'file',
            ref: 'packages/db/src/client.js:1',
            reason: 'The checked-in JavaScript artifact can go stale if regeneration is not enforced.'
          }
        ],
        recommended_controls: [
          'Regenerate the client from the schema in CI.',
          'Fail the build when the generated artifact differs from the source input.'
        ],
        dedupe_keys: ['artifact-integrity:client-drift', 'generated:stale-runtime'],
        tags: ['generated', 'schema']
      }
    ],
    dedupeClusters: [
      {
        cluster_id: 'cluster-artifact-integrity',
        root_cause: 'Generated runtime artifacts can drift from their source input.',
        finding_ids: ['finding-artifact-001'],
        remediation_surface: 'codegen and build validation'
      }
    ]
  },
  {
    description: 'Config drift prompt stays grounded on production boot and auth bypass flags',
    promptPath: '.agents/prompts/config-drift.md',
    expectedCategories: ['config_drift'],
    expectedAgent: 'config_drift_agent',
    canonicalFindings: [
      {
        agent: 'config_drift_agent',
        finding_id: 'finding-config-001',
        category: 'config_drift',
        finding_type: 'fallback_mismatch',
        severity: 'high',
        confidence: 0.9,
        predicted_failure: {
          summary: 'The production guard and local auth bypass can diverge, letting a fixture-only setting leak into a live deployment.',
          failure_mode: 'A production environment runs with a local-only auth bypass or a stale fallback variable.',
          trigger_conditions: [
            'Environment validation does not reject the bypass flag in production.',
            'The middleware path accepts the bypass before route auth runs.'
          ],
          blast_radius: 'Auth middleware, worker routes, and every authenticated surface'
        },
        why_it_matters: 'A single config mismatch can turn the whole app into a fixture-mode deployment.',
        affected_assets: ['packages/domain/src/production-mode.ts', 'apps/web/middleware.ts'],
        evidence: [
          {
            kind: 'file',
            ref: 'packages/domain/src/production-mode.ts:1',
            reason: 'Boot-time config validation must reject unsafe production combinations.'
          },
          {
            kind: 'file',
            ref: 'apps/web/middleware.ts:1',
            reason: 'The middleware decides whether auth is enforced on incoming requests.'
          }
        ],
        recommended_controls: [
          'Fail production boot if auth bypass flags are present.',
          'Add a config regression test that exercises the middleware in production mode.'
        ],
        dedupe_keys: ['config-drift:auth-bypass', 'production:boot-validation'],
        tags: ['config', 'auth']
      }
    ],
    dedupeClusters: [
      {
        cluster_id: 'cluster-config-drift',
        root_cause: 'Production boot checks and runtime auth bypass flags are not aligned.',
        finding_ids: ['finding-config-001'],
        remediation_surface: 'boot validation and middleware'
      }
    ]
  },
  {
    description: 'Ownership change risk prompt keeps churn and hotspot risk tied to the audit pipeline',
    promptPath: '.agents/prompts/ownership-change-risk.md',
    expectedCategories: ['ownership_change_risk'],
    expectedAgent: 'ownership_change_risk_agent',
    canonicalFindings: [
      {
        agent: 'ownership_change_risk_agent',
        finding_id: 'finding-ownership-001',
        category: 'ownership_change_risk',
        finding_type: 'hotspot_without_guardrail',
        severity: 'medium',
        confidence: 0.85,
        predicted_failure: {
          summary: 'A central audit path keeps changing across multiple surfaces without an explicit regression gate.',
          failure_mode: 'Routine edits in the audit pipeline introduce regressions because ownership and review routing are unclear.',
          trigger_conditions: [
            'Several linked routes and read-model files change together.',
            'No hotspot-specific regression gate protects the shared audit path.'
          ],
          blast_radius: 'Audit runtime, reviewer console, and publish actions'
        },
        why_it_matters: 'Churn-heavy hotspots need explicit ownership so regressions do not repeat.',
        affected_assets: ['services/orchestrator/src/scheduler/run-audit.ts', 'apps/web/app/api/audits/run/route.ts'],
        evidence: [
          {
            kind: 'file',
            ref: 'services/orchestrator/src/scheduler/run-audit.ts:1',
            reason: 'The orchestrator scheduler is a central shared path with broad blast radius.'
          },
          {
            kind: 'file',
            ref: 'apps/web/app/api/audits/run/route.ts:1',
            reason: 'The BFF route is part of the same hot path that front-line changes often touch.'
          }
        ],
        recommended_controls: [
          'Assign explicit code ownership for the audit hot path.',
          'Add a hotspot regression gate that runs on audit-path changes.'
        ],
        dedupe_keys: ['ownership:hotspot', 'audit:path-churn'],
        tags: ['ownership', 'hotspot']
      }
    ],
    dedupeClusters: [
      {
        cluster_id: 'cluster-ownership-risk',
        root_cause: 'A central audit path lacks an explicit change guardrail.',
        finding_ids: ['finding-ownership-001'],
        remediation_surface: 'ownership routing and regression gating'
      }
    ]
  },
  {
    description: 'Performance SLO prompt keeps read-path latency tied to the audit snapshot hydrator',
    promptPath: '.agents/prompts/performance-slo.md',
    expectedCategories: ['performance_slo'],
    expectedAgent: 'performance_slo_agent',
    canonicalFindings: [
      {
        agent: 'performance_slo_agent',
        finding_id: 'finding-performance-001',
        category: 'performance_slo',
        finding_type: 'slow_read_path',
        severity: 'high',
        confidence: 0.9,
        predicted_failure: {
          summary: 'The audit snapshot hydrator can turn a polling read path into a slow, user-visible bottleneck.',
          failure_mode: 'Every console refresh rehydrates heavy data and source snippets without a latency budget.',
          trigger_conditions: [
            'The UI polls the audit route while the read model is still hydrating evidence.',
            'The snapshot path resolves source snippets for every refresh without caching.'
          ],
          blast_radius: 'Audit history, issue detail, and the /app console'
        },
        why_it_matters: 'A slow read model makes the console feel broken even when the backend is correct.',
        affected_assets: ['services/orchestrator/src/read-model/index.ts', 'apps/web/src/hooks/use-os-console-data.ts'],
        evidence: [
          {
            kind: 'file',
            ref: 'services/orchestrator/src/read-model/index.ts:1',
            reason: 'The read model hydrates evidence and snapshot data before the console can render.'
          },
          {
            kind: 'file',
            ref: 'apps/web/src/hooks/use-os-console-data.ts:1',
            reason: 'The console data hook polls the audit state repeatedly.'
          }
        ],
        recommended_controls: [
          'Add a latency budget for the hydrated audit snapshot.',
          'Cache stable read-model fields and reduce poll frequency for inactive audits.'
        ],
        dedupe_keys: ['performance:read-path', 'slo:audit-snapshot'],
        tags: ['performance', 'slo']
      }
    ],
    dedupeClusters: [
      {
        cluster_id: 'cluster-performance-slo',
        root_cause: 'A polling read path does too much work per refresh.',
        finding_ids: ['finding-performance-001'],
        remediation_surface: 'read model hydration and UI polling'
      }
    ]
  },
  {
    description: 'Product gap prompt keeps project inventory behavior tied to explicit repository selection',
    promptPath: '.agents/prompts/product-gap.md',
    expectedCategories: ['product_gap'],
    expectedAgent: 'product_gap_agent',
    canonicalFindings: [
      {
        agent: 'product_gap_agent',
        finding_id: 'finding-product-001',
        category: 'product_gap',
        finding_type: 'missing_explicit_selection',
        severity: 'high',
        confidence: 0.88,
        predicted_failure: {
          summary: 'Repositories can enter inventory without a deliberate user selection step.',
          failure_mode: 'The inventory view shows connected repositories that were never explicitly enabled by the user.',
          trigger_conditions: [
            'Repository discovery runs before the user confirms the selection.',
            'The enable action mutates inventory state without an explicit choice event.'
          ],
          blast_radius: 'Project inventory, onboarding, and integration management'
        },
        why_it_matters: 'Inventory should reflect deliberate user intent, not implicit discovery.',
        affected_assets: ['apps/web/app/api/workspace/integrations/[id]/repositories/enable/route.ts', 'apps/web/app/api/workspace/integrations/[id]/repositories/route.ts'],
        evidence: [
          {
            kind: 'file',
            ref: 'apps/web/app/api/workspace/integrations/[id]/repositories/enable/route.ts:1',
            reason: 'The enable route controls whether a repository becomes part of inventory.'
          },
          {
            kind: 'file',
            ref: 'apps/web/app/api/workspace/integrations/[id]/repositories/route.ts:1',
            reason: 'The repository listing route is where explicit selection should be surfaced.'
          }
        ],
        recommended_controls: [
          'Require an explicit selection confirmation before enabling a repository.',
          'Display enabled state separately from discovered state in the inventory UI.'
        ],
        dedupe_keys: ['product:inventory-selection', 'integration:explicit-enable'],
        tags: ['product', 'inventory']
      }
    ],
    dedupeClusters: [
      {
        cluster_id: 'cluster-product-gap',
        root_cause: 'Repository inventory state is not separated from discovery state.',
        finding_ids: ['finding-product-001'],
        remediation_surface: 'inventory UX and enable route'
      }
    ]
  },
  {
    description: 'Security threat model prompt keeps trust-boundary risk tied to worker and auth headers',
    promptPath: '.agents/prompts/security-threat-model.md',
    expectedCategories: ['security_threat_model'],
    expectedAgent: 'security_threat_model_agent',
    canonicalFindings: [
      {
        agent: 'security_threat_model_agent',
        finding_id: 'finding-security-001',
        category: 'security_threat_model',
        finding_type: 'trust_boundary_crossing',
        severity: 'critical',
        confidence: 0.93,
        predicted_failure: {
          summary: 'The API worker can be reached with caller-controlled identity headers unless the signed context is verified.',
          failure_mode: 'A caller can cross the worker boundary and impersonate another identity by shaping headers instead of proving identity.',
          trigger_conditions: [
            'The API worker accepts request headers that were not signed by the shared secret.',
            'A downstream route trusts the forwarded identity without rechecking the signature.'
          ],
          blast_radius: 'All authenticated API routes and tenant-scoped data access'
        },
        why_it_matters: 'A trust-boundary failure can expose every tenant-controlled surface.',
        affected_assets: ['apps/api/src/lib/request-context.ts', 'apps/api/src/lib/cors.ts'],
        evidence: [
          {
            kind: 'file',
            ref: 'apps/api/src/lib/request-context.ts:1',
            reason: 'The API worker resolves caller identity and organization context here.'
          },
          {
            kind: 'file',
            ref: 'apps/api/src/lib/cors.ts:1',
            reason: 'The cross-origin boundary has to permit only the signed identity headers.'
          }
        ],
        recommended_controls: [
          'Verify the signed identity headers before honoring caller context.',
          'Drop spoofable raw identity headers from cross-origin access patterns.'
        ],
        dedupe_keys: ['security:worker-boundary', 'auth:signed-headers'],
        tags: ['security', 'boundary']
      }
    ],
    dedupeClusters: [
      {
        cluster_id: 'cluster-security-threat-model',
        root_cause: 'Signed identity is required at the worker boundary.',
        finding_ids: ['finding-security-001'],
        remediation_surface: 'auth headers and CORS policy'
      }
    ]
  },
  {
    description: 'Test adequacy prompt keeps route body parsing and issue transitions tied to missing regression coverage',
    promptPath: '.agents/prompts/test-adequacy.md',
    expectedCategories: ['test_adequacy'],
    expectedAgent: 'test_adequacy_agent',
    canonicalFindings: [
      {
        agent: 'test_adequacy_agent',
        finding_id: 'finding-test-001',
        category: 'test_adequacy',
        finding_type: 'missing_regression_test',
        severity: 'high',
        confidence: 0.9,
        predicted_failure: {
          summary: 'The route body parser and the issue review transitions can regress without a test that exercises the real request shape.',
          failure_mode: 'A route body cast or action branch is changed and the existing test layout never catches the break.',
          trigger_conditions: [
            'The route accepts a malformed JSON body that tests do not cover.',
            'The review action flow changes without a corresponding route regression test.'
          ],
          blast_radius: 'Audit submission, issue review, and published issue workflows'
        },
        why_it_matters: 'A missing test near the route boundary lets broken behavior ship silently.',
        affected_assets: ['apps/web/app/api/audits/run/route.ts', 'apps/web/app/api/audits/[id]/issues/[issueId]/action/route.ts'],
        evidence: [
          {
            kind: 'file',
            ref: 'apps/web/app/api/audits/run/route.ts:1',
            reason: 'The audit submit route now parses request bodies and needs coverage for malformed inputs.'
          },
          {
            kind: 'file',
            ref: 'apps/web/app/api/audits/[id]/issues/[issueId]/action/route.ts:1',
            reason: 'The review action route contains multiple branches that should be regression tested.'
          }
        ],
        recommended_controls: [
          'Add route-level tests for malformed body parsing and action routing.',
          'Lock the audit and issue transition behavior with regression cases.'
        ],
        dedupe_keys: ['test:route-body', 'test:issue-transitions'],
        tags: ['tests', 'routes']
      }
    ],
    dedupeClusters: [
      {
        cluster_id: 'cluster-test-adequacy',
        root_cause: 'Critical route transitions lack focused regression coverage.',
        finding_ids: ['finding-test-001'],
        remediation_surface: 'route tests and transition guards'
      }
    ]
  }
];

export default function generateFindingTests() {
  return [
    ...promptCases.map((entry) =>
      makeFindingTestCase({
        description: entry.description,
        promptPath: entry.promptPath,
        canonicalFindings: entry.canonicalFindings,
        dedupeClusters: entry.dedupeClusters,
        expectedCategories: entry.expectedCategories,
        expectedAgent: entry.expectedAgent,
        expectRefusal: entry.expectRefusal
      })
    ),
    makeFindingTestCase({
      description: 'Finding synthesizer returns a refusal envelope for docs-only changes',
      promptPath: '.agents/prompts/finding-synthesizer.md',
      canonicalFindings: [],
      dedupeClusters: [],
      expectedCategories: [],
      expectedAgent: 'finding_synthesizer_agent',
      expectRefusal: true
    })
  ];
}
