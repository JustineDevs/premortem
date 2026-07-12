CREATE INDEX "provider_connections_org_provider_status_updated_at_idx" ON "provider_connections" ("organizationId", "provider", "status", "updatedAt" DESC);

CREATE INDEX "projects_organization_updated_at_idx" ON "projects" ("organizationId", "updatedAt" DESC);

CREATE INDEX "audit_runs_org_project_branch_status_created_at_idx" ON "audit_runs" ("organizationId", "projectId", "branch", "runStatus", "createdAt" DESC);

CREATE INDEX "issue_candidates_audit_run_reviewer_status_idx" ON "issue_candidates" ("auditRunId", "reviewerStatus");

CREATE INDEX "published_issues_organization_updated_at_idx" ON "published_issues" ("organizationId", "updatedAt" DESC);

CREATE INDEX "published_issues_project_external_issue_iid_idx" ON "published_issues" ("projectId", "externalIssueIid");

CREATE INDEX "published_issues_org_project_outcome_type_idx" ON "published_issues" ("organizationId", "projectId", "outcomeType");

CREATE INDEX "organization_invitations_org_email_status_created_at_idx" ON "organization_invitations" ("organizationId", "email", "status", "createdAt" DESC);

CREATE INDEX "organization_api_keys_key_prefix_idx" ON "organization_api_keys" ("keyPrefix");

CREATE INDEX "notifications_user_org_created_at_idx" ON "notifications" ("userId", "organizationId", "createdAt" DESC);

CREATE INDEX "notifications_user_org_read_at_idx" ON "notifications" ("userId", "organizationId", "readAt");

CREATE INDEX "usage_events_org_event_type_created_at_idx" ON "usage_events" ("organizationId", "eventType", "createdAt" DESC);
