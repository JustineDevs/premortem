/** Canonical feature flags: create matching flags in PostHog. */
export declare const CanonicalFeatureFlags: {
    readonly workflowCanvas: "workflow-canvas";
    readonly adHocSandbox: "ad-hoc-sandbox";
    readonly stripeBilling: "stripe-billing";
    readonly gitlabReconcile: "gitlab-reconcile";
};
export declare function isFeatureEnabled(distinctId: string, flag: string, defaultValue?: boolean): Promise<boolean>;
//# sourceMappingURL=feature-flags.d.ts.map