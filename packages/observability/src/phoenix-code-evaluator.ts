export interface PhoenixEvaluatorParams {
  output?: unknown;
  reference?: unknown;
  input?: unknown;
  metadata?: Record<string, unknown> | null;
}

export interface AuditMissionEvalOutput {
  findingCount?: number;
  issueCandidateCount?: number;
  hasHumanReviewGate?: boolean;
}

export interface AuditMissionEvalReference {
  minFindingCount?: number;
  minScore?: number;
}

export interface PhoenixCodeEvalResult {
  label: 'passed' | 'needs_review';
  score: number;
  explanation: string;
}

export function scoreAuditMissionOutput(
  output: AuditMissionEvalOutput,
  reference: AuditMissionEvalReference = {}
) {
  const minFindingCount = reference.minFindingCount ?? 1;
  const minScore = reference.minScore ?? 0.66;

  const findingCount = Number(output.findingCount ?? 0);
  const issueCandidateCount = Number(output.issueCandidateCount ?? 0);
  const hasHumanReviewGate = Boolean(output.hasHumanReviewGate);

  const checks = [
    {
      name: 'findings_present',
      pass: findingCount >= minFindingCount,
      score: findingCount >= minFindingCount ? 1 : 0
    },
    {
      name: 'issue_candidates_generated',
      pass: issueCandidateCount >= 0,
      score: issueCandidateCount > 0 ? 1 : 0.5
    },
    {
      name: 'human_review_gate',
      pass: hasHumanReviewGate,
      score: hasHumanReviewGate ? 1 : 0
    }
  ];

  const score =
    checks.reduce((total, check) => total + check.score, 0) / Math.max(checks.length, 1);
  const passed = score >= minScore;

  return {
    checks,
    score,
    passed,
    label: passed ? ('passed' as const) : ('needs_review' as const),
    explanation: [
      `Finding count: ${findingCount} (min ${minFindingCount}).`,
      `Issue candidates: ${issueCandidateCount}.`,
      `Human review gate: ${hasHumanReviewGate ? 'enabled' : 'missing'}.`,
      `Weighted score ${score.toFixed(2)} vs threshold ${minScore.toFixed(2)}.`
    ].join(' ')
  };
}

/** Matches Phoenix server code evaluator `evaluate(...)` for TypeScript sandboxes. */
export function evaluatePremortemAuditMission({
  output,
  reference
}: PhoenixEvaluatorParams): PhoenixCodeEvalResult {
  const missionOutput = (output ?? {}) as AuditMissionEvalOutput;
  const missionReference = (reference ?? {}) as AuditMissionEvalReference;
  const result = scoreAuditMissionOutput(missionOutput, missionReference);

  return {
    label: result.label,
    score: result.score,
    explanation: result.explanation
  };
}

/** Source file path for Phoenix UI "Create code evaluator" import. */
export const PREMORTEM_PHOENIX_CODE_EVALUATOR_PATH =
  'packages/observability/phoenix-evaluators/premortem-audit-mission.eval.ts';
