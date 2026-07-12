import { PostHog } from 'posthog-node';
/** PostHog capture/evaluate requires a project key (`phc_`), not a personal API key (`phx_`). */
export declare function resolvePostHogProjectKey(): string;
declare function getPostHogClient(): PostHog;
export declare function trackServerEvent(distinctId: string, event: string, properties?: Record<string, unknown>): void;
export declare function shutdownPostHog(): Promise<void>;
export declare function probePostHogDelivery(distinctId?: string, event?: string, properties?: Record<string, unknown>): Promise<void>;
export { getPostHogClient };
//# sourceMappingURL=posthog.d.ts.map
