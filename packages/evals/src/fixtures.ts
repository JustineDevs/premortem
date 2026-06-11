export interface EvalFixture {
  id: string;
  repoScenario: string;
  expectedIssueCount: number;
  expectedCategories: string[];
}

export interface FindingSynthesizerFixture extends EvalFixture {
  canonicalFindings: Array<{
    agent: string;
    finding_id: string;
    category: string;
    finding_type: string;
    severity: 'low' | 'medium' | 'high' | 'critical';
    confidence: number;
    predicted_failure: {
      summary: string;
      failure_mode?: string;
      trigger_conditions: string[];
      blast_radius?: string;
    };
    why_it_matters?: string;
    affected_assets: string[];
    evidence: Array<{
      kind: string;
      ref: string;
      reason: string;
    }>;
    recommended_controls: string[];
    dedupe_keys: string[];
    tags: string[];
  }>;
  dedupeClusters: Array<{
    cluster_id: string;
    root_cause: string;
    finding_ids: string[];
    remediation_surface: string;
  }>;
}

export const findingSynthesizerFixtures: FindingSynthesizerFixture[] = [
  {
    id: 'migration-release-guard',
    repoScenario: 'A migration path lacks deploy sequencing and rollback coverage.',
    expectedIssueCount: 1,
    expectedCategories: ['release_safety'],
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
      },
      {
        agent: 'observability_recovery_agent',
        finding_id: 'finding-observability-001',
        category: 'release_safety',
        finding_type: 'missing_recovery_signal',
        severity: 'high',
        confidence: 0.84,
        predicted_failure: {
          summary: 'A broken migration rollout would fail without a health signal tied to schema readiness.',
          trigger_conditions: [
            'Health checks stay green while schema-dependent queries fail.',
            'No alert fires when audit reads start returning server errors.'
          ],
          blast_radius: 'Operators do not detect rollout failure until reviewer traffic breaks.'
        },
        why_it_matters: 'The team cannot revert quickly because the failure mode is silent at rollout time.',
        affected_assets: ['apps/api/src/local-server.ts', 'packages/observability/src/sentry.ts'],
        evidence: [
          {
            kind: 'code',
            ref: 'apps/api/src/local-server.ts:1',
            reason: 'Health endpoint does not assert schema readiness.'
          },
          {
            kind: 'code',
            ref: 'packages/observability/src/sentry.ts:1',
            reason: 'Observability hooks exist but no release-specific alert event is emitted here.'
          }
        ],
        recommended_controls: [
          'Emit a rollout readiness signal once schema-dependent reads succeed.',
          'Alert on failed audit-read probes during rollout.'
        ],
        dedupe_keys: ['release:migration-order', 'observability:schema-readiness'],
        tags: ['deploy', 'health']
      }
    ],
    dedupeClusters: [
      {
        cluster_id: 'cluster-release-guard',
        root_cause: 'Schema-dependent rollout is missing a migration gate and health signal.',
        finding_ids: ['finding-release-001', 'finding-observability-001'],
        remediation_surface: 'deployment pipeline and rollout readiness checks'
      }
    ]
  }
];
