import { PostHog } from 'posthog-node';
/** PostHog capture/evaluate requires a project key (`phc_`), not a personal API key (`phx_`). */
export declare function resolvePostHogProjectKey(): string | null;
declare function getPostHogClient(): PostHog | null;
export declare function trackServerEvent(distinctId: string, event: string, properties?: Record<string, unknown>): void;
export declare function shutdownPostHog(): Promise<void>;
export { getPostHogClient };
//# sourceMappingURL=posthog.d.ts.map