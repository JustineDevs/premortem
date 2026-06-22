export const DEFAULT_SPECIALIST_CONCURRENCY = 5;

export const AUDIT_WORKFLOW_CONTRACT = {
  goal: 'Goal-driven convergence over stochastic generation',
  insideView: [
    'Ground every prediction in the current payload, repo tree, graph grounding, and validation policy.',
    'Use exact repository files, routes, schema fields, and dependency edges.',
    'Do not invent relations that are not present in the supplied graph or payload.'
  ],
  outsideView: [
    'Cross-check each risk against realistic base rates for software delivery, auth, integration, and release failure.',
    'Prefer common operational failure classes over speculative or exotic failure classes.',
    'If the stack does not support a failure class, reject it instead of guessing.'
  ],
  triage: {
    deterministic: [
      'Hardcoded secrets or tokens.',
      'Missing required configuration or env vars.',
      'Unprotected writes or auth boundaries.',
      'Schema or route mismatches that are guaranteed to fail.'
    ],
    probabilistic: [
      'Adoption friction.',
      'Performance degradation.',
      'Operational drift.',
      'Cross-team coordination risk.'
    ]
  },
  delegation: {
    auditors: 'Maximize recall by searching for concrete future failure modes.',
    critics: 'Maximize precision by challenging each finding with contradictory evidence.',
    synthesizer: 'Merge only shared root causes into smaller issue candidates.',
    validator:
      'Reject weak, generic, duplicate, or under-evidenced issues after consensus review across independent worker lanes.'
  },
  consensus: {
    required: [
      'A reviewer-facing issue must be supported by at least one deterministic failure surface or by converging evidence from multiple independent specialist lanes.',
      'Single-lane noise should be discarded unless the surface is a hard failure with exact repository evidence.',
      'If the candidate only restates one worker opinion, reject it as alert fatigue.'
    ],
    allowed: [
      'Deterministic failures with exact refs.',
      'Cross-lane convergence on the same remediation surface.',
      'Strong evidence of a concrete review or publish gate defect.'
    ]
  },
  circuitBreakers: [
    'Return an empty envelope when no grounded critical risk is present.',
    'Return an empty envelope when evidence is too thin to defend the claim.',
    'Do not inflate the output with generic advice to satisfy the schema.'
  ],
  loopPolicy: {
    maxSpecialistConcurrency: DEFAULT_SPECIALIST_CONCURRENCY,
    stopCondition: 'Stop once the output is schema-valid, grounded, and publication-ready.',
    retryCondition: 'Retry only after invalid JSON, missing evidence, or rejected validation.'
  }
} as const;

export function formatAuditWorkflowContract() {
  return [
    '# Premortem Workflow Contract',
    '',
    '## Goal',
    AUDIT_WORKFLOW_CONTRACT.goal,
    '',
    '## Inside View',
    ...AUDIT_WORKFLOW_CONTRACT.insideView.map((line) => `- ${line}`),
    '',
    '## Outside View',
    ...AUDIT_WORKFLOW_CONTRACT.outsideView.map((line) => `- ${line}`),
    '',
    '## Triage',
    ...AUDIT_WORKFLOW_CONTRACT.triage.deterministic.map((line) => `- Deterministic: ${line}`),
    ...AUDIT_WORKFLOW_CONTRACT.triage.probabilistic.map((line) => `- Probabilistic: ${line}`),
    '',
    '## Delegation',
    `- Auditors: ${AUDIT_WORKFLOW_CONTRACT.delegation.auditors}`,
    `- Critics: ${AUDIT_WORKFLOW_CONTRACT.delegation.critics}`,
    `- Synthesizer: ${AUDIT_WORKFLOW_CONTRACT.delegation.synthesizer}`,
    `- Validator: ${AUDIT_WORKFLOW_CONTRACT.delegation.validator}`,
    '',
    '## Consensus Validation',
    ...AUDIT_WORKFLOW_CONTRACT.consensus.required.map((line) => `- Required: ${line}`),
    ...AUDIT_WORKFLOW_CONTRACT.consensus.allowed.map((line) => `- Allowed: ${line}`),
    '',
    '## Circuit Breaker',
    ...AUDIT_WORKFLOW_CONTRACT.circuitBreakers.map((line) => `- ${line}`),
    '',
    '## Loop Policy',
    `- Maximum specialist concurrency: ${AUDIT_WORKFLOW_CONTRACT.loopPolicy.maxSpecialistConcurrency}.`,
    `- Stop condition: ${AUDIT_WORKFLOW_CONTRACT.loopPolicy.stopCondition}`,
    `- Retry condition: ${AUDIT_WORKFLOW_CONTRACT.loopPolicy.retryCondition}`
  ].join('\n');
}
