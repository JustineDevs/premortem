import { LangfuseClient } from '@langfuse/client';
export interface ManagedPromptOptions {
    label?: string;
    type?: 'text' | 'chat';
    fallback?: string;
}
export declare function isLangfuseConfigured(): boolean;
export declare function getLangfuseClient(): LangfuseClient;
export declare function getManagedPrompt(name: string, options?: ManagedPromptOptions): Promise<string | import("@langfuse/client").ChatPromptClient | import("@langfuse/client").TextPromptClient>;
export declare function createLangfuseScore(input: {
    traceId: string;
    name: string;
    value: number;
    comment?: string;
}): Promise<void>;
export declare function shutdownLangfuse(): Promise<void>;
export declare function probeLangfuseDelivery(input?: {
    traceId?: string;
    name?: string;
    value?: number;
    comment?: string;
}): Promise<void>;
//# sourceMappingURL=langfuse.d.ts.map
