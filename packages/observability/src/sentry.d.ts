import type { SeverityLevel } from '@sentry/node';
import type { NodeOptions } from '@sentry/node';
export declare function getServerSentryInitOptions(serviceName: string): NodeOptions;
export declare function initServerObservability(serviceName: string): void;
export declare function captureServerException(error: unknown, context?: Record<string, unknown>): void;
export declare function captureServerMessage(message: string, level?: SeverityLevel): void;
//# sourceMappingURL=sentry.d.ts.map