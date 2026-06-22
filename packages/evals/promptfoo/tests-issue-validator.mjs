import { makeValidatorTestCase } from './shared-fixtures.mjs';

const validIssueCandidate = {
  title: 'Publish gate bypass in apps/api/src/routes/publish.ts',
  category: 'trust_boundary',
  severity: 'high',
  confidence: 0.92,
  predicted_failure_summary:
    'A low-trust route in apps/api/src/routes/publish.ts can still publish production changes because the reviewer gate is not enforced.',
  why_it_matters: 'Production writes lose their human approval boundary.',
  trigger_conditions: [
    'The publish route accepts client state without server-side approval checks.',
    'A release path can call publish before review is recorded.'
  ],
  evidence: [
    {
      kind: 'file',
      ref: 'apps/api/src/routes/publish.ts',
      reason: 'The route is the publish entrypoint.'
    },
    {
      kind: 'file',
      ref: 'packages/db/src/entitlements.ts',
      reason: 'Publish should be constrained by server-side entitlement checks.'
    }
  ],
  recommended_action_summary: 'Enforce the reviewer gate on the server and add regression coverage.',
  implementation_steps: [
    'Patch the publish route to reject unapproved states.',
    'Add an integration test that proves the route fails without review.'
  ],
  done_criteria: [
    'Publish is blocked until review approval exists.',
    'The new regression test fails if the gate is removed.'
  ],
  affected_assets: ['apps/api/src/routes/publish.ts'],
  source_agents: ['trust_boundary_agent'],
  source_findings: ['finding-001']
};

const duplicateIssueCandidate = {
  ...validIssueCandidate,
  title: 'Publish gate bypass in apps/api/src/routes/publish.ts',
  source_findings: ['finding-001', 'finding-duplicate-001']
};

const weaklyGroundedIssueCandidate = {
  ...validIssueCandidate,
  title: 'Review flow issue',
  confidence: 0.5,
  evidence: [],
  trigger_conditions: ['Something goes wrong.'],
  implementation_steps: [],
  done_criteria: [],
  affected_assets: [],
  source_agents: [],
  source_findings: []
};

const singleLaneNoiseIssueCandidate = {
  ...validIssueCandidate,
  title: 'Potential issue from one noisy lane',
  confidence: 0.61,
  evidence: [
    {
      kind: 'file',
      ref: 'services/orchestrator/src/scheduler/run-audit.ts',
      reason: 'One worker lane emits the concern, but there is no second anchor or deterministic breakage.'
    }
  ],
  trigger_conditions: ['A single specialist mentions a possible problem.'],
  implementation_steps: ['Consider investigating the issue.'],
  done_criteria: ['The team feels comfortable with the output.'],
  affected_assets: ['services/orchestrator/src/scheduler/run-audit.ts'],
  source_agents: ['trust_boundary_agent'],
  source_findings: ['finding-noise-001']
};

export default function generateValidatorTests() {
  return [
    makeValidatorTestCase({
      description: "Don't Waste My Time: issue validator accepts a publication-ready issue candidate",
      promptPath: '.agents/prompts/issue-validator.md',
      issueCandidates: [validIssueCandidate],
      expectedAgent: 'issue_validator_agent'
    }),
    makeValidatorTestCase({
      description: 'Context Boundary: issue validator returns a refusal envelope for duplicate-only input',
      promptPath: '.agents/prompts/issue-validator.md',
      issueCandidates: [duplicateIssueCandidate],
      expectRefusal: true,
      expectedAgent: 'issue_validator_agent'
    }),
    makeValidatorTestCase({
      description: 'Context Boundary: issue validator returns a refusal envelope for weakly grounded input',
      promptPath: '.agents/prompts/issue-validator.md',
      issueCandidates: [weaklyGroundedIssueCandidate],
      expectRefusal: true,
      expectedAgent: 'issue_validator_agent'
    }),
    makeValidatorTestCase({
      description: 'Workflow Disruption: issue validator rejects single-lane noise without consensus support',
      promptPath: '.agents/prompts/issue-validator.md',
      issueCandidates: [singleLaneNoiseIssueCandidate],
      expectRefusal: true,
      expectedAgent: 'issue_validator_agent'
    })
  ];
}
