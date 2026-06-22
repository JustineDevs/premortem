export declare function getLLMAttributes(...args: any[]): Promise<any>;
export declare const trace: any;
export declare function traceAgent(...args: any[]): Promise<any>;
export declare function traceChain(...args: any[]): Promise<any>;
export declare function traceTool(...args: any[]): Promise<any>;
export declare function withSpan(...args: any[]): Promise<any>;
export declare function resolvePhoenixUrl(): string;
export declare function resolvePhoenixMcpBaseUrl(): string;
export interface PhoenixEndpointProbe {
    ok: boolean;
    baseUrl: string;
    status: number;
    serverVersion: string | null;
    contentType: string | null;
    bodyPreview?: string;
    error?: string;
}
export declare function probePhoenixEndpoint(): Promise<PhoenixEndpointProbe>;
export declare function isPhoenixEnabled(): boolean;
export declare function initPhoenixTracing(serviceName: string): {
    shutdown: () => Promise<void>;
} | undefined;
export declare function shutdownPhoenixTracing(): Promise<void>;
export declare const tracePremortemAgentMission: typeof traceAgent;
export declare const tracePremortemAuditJob: typeof traceChain;
export declare const tracePremortemToolCall: typeof traceTool;
export interface PhoenixLlmSpanInput {
    model: string;
    provider?: string;
    spanName?: string;
    messages: Array<{
        role: string;
        content: string;
    }>;
    temperature?: number;
}
export declare function tracePremortemLlmGenerate<T>(input: PhoenixLlmSpanInput, fn: () => Promise<T>): Promise<T>;
export interface AuditFindingEvalInput {
    auditRunId: string;
    findingCount: number;
    issueCandidateCount: number;
    hasHumanReviewGate: boolean;
    findingConfidenceAvg?: number;
    evidenceCountMin?: number;
    refusalRate?: number;
}
export declare function evaluateAuditMissionQuality(input: AuditFindingEvalInput): {
    evaluator: string;
    auditRunId: string;
    score: number;
    passed: boolean;
    label: "passed" | "needs_review";
    explanation: string;
    checks: {
        name: string;
        pass: boolean;
        score: number;
    }[];
};
export interface AuditMissionLlmJudgeInput {
    auditRunId: string;
    findingCount: number;
    issueCandidateCount: number;
    sampleFindingTitles?: string[];
    apiKey: string;
    model?: string;
}
export interface AuditMissionLlmJudgeResult {
    evaluator: 'premortem-llm-judge';
    auditRunId: string;
    label: 'acceptable' | 'needs_improvement';
    score: number;
    passed: boolean;
    explanation: string;
}
export declare function evaluateAuditMissionWithLlmJudge(input: AuditMissionLlmJudgeInput): Promise<AuditMissionLlmJudgeResult>;
//# sourceMappingURL=phoenix.d.ts.map
