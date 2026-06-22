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
export declare function scoreAuditMissionOutput(output: AuditMissionEvalOutput, reference?: AuditMissionEvalReference): {
    checks: {
        name: string;
        pass: boolean;
        score: number;
    }[];
    score: number;
    passed: boolean;
    label: "passed" | "needs_review";
    explanation: string;
};
/** Matches Phoenix server code evaluator `evaluate(...)` for TypeScript sandboxes. */
export declare function evaluatePremortemAuditMission({ output, reference }: PhoenixEvaluatorParams): PhoenixCodeEvalResult;
/** Source file path for Phoenix UI "Create code evaluator" import. */
export declare const PREMORTEM_PHOENIX_CODE_EVALUATOR_PATH = "packages/observability/phoenix-evaluators/premortem-audit-mission.eval.ts";
//# sourceMappingURL=phoenix-code-evaluator.d.ts.map