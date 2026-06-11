/** Canonical PostHog event names for Premortem (ADR §7). */
export const CanonicalEvents = {
  auditTriggered: 'audit_triggered',
  auditCancelled: 'audit_cancelled',
  auditPaused: 'audit_paused',
  auditResumed: 'audit_resumed',
  auditCompleted: 'audit_completed',
  integrationRegistered: 'integration_registered',
  integrationSynced: 'integration_synced',
  gitlabConnected: 'gitlab_connected',
  configValidated: 'config_validation_passed',
  issuesReconciled: 'issues_reconciled',
  issueReviewed: 'issue_reviewed',
  issuePublished: 'issue_published',
  projectRegistered: 'project_registered',
  workspaceCreated: 'workspace_created',
  checkoutStarted: 'checkout_started',
  pageViewed: '$pageview'
} as const;

export type CanonicalEventName = (typeof CanonicalEvents)[keyof typeof CanonicalEvents];
