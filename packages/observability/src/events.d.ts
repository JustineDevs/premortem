/** Canonical PostHog event names for Premortem (ADR §7). */
export declare const CanonicalEvents: {
    readonly auditTriggered: "audit_triggered";
    readonly auditCancelled: "audit_cancelled";
    readonly auditPaused: "audit_paused";
    readonly auditResumed: "audit_resumed";
    readonly auditCompleted: "audit_completed";
    readonly integrationRegistered: "integration_registered";
    readonly integrationSynced: "integration_synced";
    readonly gitlabConnected: "gitlab_connected";
    readonly configValidated: "config_validation_passed";
    readonly issuesReconciled: "issues_reconciled";
    readonly issueReviewed: "issue_reviewed";
    readonly issuePublished: "issue_published";
    readonly projectRegistered: "project_registered";
    readonly workspaceCreated: "workspace_created";
    readonly checkoutStarted: "checkout_started";
    readonly pageViewed: "$pageview";
};
export type CanonicalEventName = (typeof CanonicalEvents)[keyof typeof CanonicalEvents];
//# sourceMappingURL=events.d.ts.map