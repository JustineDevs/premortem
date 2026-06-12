/**
 * Premortem audit mission code evaluator for Phoenix server sandboxes (TypeScript / Deno).
 *
 * Paste this file into Phoenix: Dataset → Evaluators → Add evaluator → Create code evaluator.
 * Map `output` to experiment output, optional `reference` to golden thresholds.
 *
 * @see https://arize.com/docs/phoenix/evaluation/server-evals/code-evaluators#typescript
 */

type EvaluatorParams = {
  output?: unknown;
  reference?: unknown;
  input?: unknown;
  metadata?: Record<string, unknown> | null;
};

type AuditMissionOutput = {
  findingCount?: number;
  issueCandidateCount?: number;
  hasHumanReviewGate?: boolean;
};

type AuditMissionReference = {
  minFindingCount?: number;
  minScore?: number;
};

function evaluate({ output, reference }: EvaluatorParams) {
  const mission = (output ?? {}) as AuditMissionOutput;
  const thresholds = (reference ?? {}) as AuditMissionReference;

  const minFindingCount = thresholds.minFindingCount ?? 1;
  const minScore = thresholds.minScore ?? 0.66;

  const findingCount = Number(mission.findingCount ?? 0);
  const issueCandidateCount = Number(mission.issueCandidateCount ?? 0);
  const hasHumanReviewGate = Boolean(mission.hasHumanReviewGate);

  const checks = [
    {
      name: 'findings_present',
      score: findingCount >= minFindingCount ? 1 : 0
    },
    {
      name: 'issue_candidates_generated',
      score: issueCandidateCount > 0 ? 1 : 0.5
    },
    {
      name: 'human_review_gate',
      score: hasHumanReviewGate ? 1 : 0
    }
  ];

  const score =
    checks.reduce((total, check) => total + check.score, 0) / Math.max(checks.length, 1);
  const passed = score >= minScore;

  return {
    label: passed ? 'passed' : 'needs_review',
    score,
    explanation: [
      `Finding count: ${findingCount} (min ${minFindingCount}).`,
      `Issue candidates: ${issueCandidateCount}.`,
      `Human review gate: ${hasHumanReviewGate ? 'enabled' : 'missing'}.`,
      `Weighted score ${score.toFixed(2)} vs threshold ${minScore.toFixed(2)}.`
    ].join(' ')
  };
}

export { evaluate };
