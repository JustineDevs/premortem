create or replace function public.is_project_member(project_uuid uuid)
returns boolean
language sql
stable
as $$
  select exists (
    select 1
    from public.projects p
    join public.organization_memberships om
      on om.organization_id = p.organization_id
    where p.id = project_uuid
      and om.user_id = auth.uid()
  );
$$;

create or replace function public.is_issue_candidate_member(issue_candidate_uuid uuid)
returns boolean
language sql
stable
as $$
  select exists (
    select 1
    from public.issue_candidates ic
    join public.organization_memberships om
      on om.organization_id = ic.organization_id
    where ic.id = issue_candidate_uuid
      and om.user_id = auth.uid()
  );
$$;

create or replace function public.is_published_issue_member(published_issue_uuid uuid)
returns boolean
language sql
stable
as $$
  select exists (
    select 1
    from public.published_issues pi
    join public.organization_memberships om
      on om.organization_id = pi.organization_id
    where pi.id = published_issue_uuid
      and om.user_id = auth.uid()
  );
$$;

alter table public.idempotency_keys enable row level security;
alter table public.run_leases enable row level security;
alter table public.dead_letter_jobs enable row level security;
alter table public.prompt_versions enable row level security;
alter table public.agent_feedback enable row level security;
alter table public.audit_cost_events enable row level security;
alter table public.organization_billing_accounts enable row level security;
alter table public.stripe_webhook_events enable row level security;
alter table public.provider_connections enable row level security;
alter table public.provider_webhooks enable row level security;
alter table public.project_memberships enable row level security;
alter table public.project_settings enable row level security;
alter table public.graph_snapshots enable row level security;
alter table public.vulnerability_advisory_cache enable row level security;
alter table public.finding_evidence_refs enable row level security;
alter table public.issue_candidate_versions enable row level security;
alter table public.issue_validation_results enable row level security;
alter table public.rejected_issue_candidate_artifacts enable row level security;
alter table public.published_issue_links enable row level security;
alter table public.issue_sync_logs enable row level security;
alter table public.reconciliation_events enable row level security;
alter table public.review_actions enable row level security;
alter table public.audit_run_events enable row level security;
alter table public.notifications enable row level security;
alter table public.activity_events enable row level security;
alter table public.organization_api_keys enable row level security;
alter table public.usage_events enable row level security;

drop policy if exists idempotency_keys_service_role on public.idempotency_keys;
create policy idempotency_keys_service_role
on public.idempotency_keys
for all
using (auth.role() = 'service_role')
with check (auth.role() = 'service_role');

drop policy if exists run_leases_service_role on public.run_leases;
create policy run_leases_service_role
on public.run_leases
for all
using (auth.role() = 'service_role')
with check (auth.role() = 'service_role');

drop policy if exists dead_letter_jobs_service_role on public.dead_letter_jobs;
create policy dead_letter_jobs_service_role
on public.dead_letter_jobs
for all
using (auth.role() = 'service_role')
with check (auth.role() = 'service_role');

drop policy if exists prompt_versions_service_role on public.prompt_versions;
create policy prompt_versions_service_role
on public.prompt_versions
for all
using (auth.role() = 'service_role')
with check (auth.role() = 'service_role');

drop policy if exists agent_feedback_service_role on public.agent_feedback;
create policy agent_feedback_service_role
on public.agent_feedback
for all
using (auth.role() = 'service_role')
with check (auth.role() = 'service_role');

drop policy if exists audit_cost_events_service_role on public.audit_cost_events;
create policy audit_cost_events_service_role
on public.audit_cost_events
for all
using (auth.role() = 'service_role')
with check (auth.role() = 'service_role');

drop policy if exists organization_billing_accounts_select_member on public.organization_billing_accounts;
create policy organization_billing_accounts_select_member
on public.organization_billing_accounts
for select
using (public.is_org_member(organization_id));

drop policy if exists organization_billing_accounts_manage_admin on public.organization_billing_accounts;
create policy organization_billing_accounts_manage_admin
on public.organization_billing_accounts
for all
using (public.has_org_role(organization_id, array['owner','admin']::public.app_role[]))
with check (public.has_org_role(organization_id, array['owner','admin']::public.app_role[]));

drop policy if exists stripe_webhook_events_service_role on public.stripe_webhook_events;
create policy stripe_webhook_events_service_role
on public.stripe_webhook_events
for all
using (auth.role() = 'service_role')
with check (auth.role() = 'service_role');

drop policy if exists provider_connections_select_member on public.provider_connections;
create policy provider_connections_select_member
on public.provider_connections
for select
using (public.is_org_member(organization_id));

drop policy if exists provider_connections_manage_admin on public.provider_connections;
create policy provider_connections_manage_admin
on public.provider_connections
for all
using (public.has_org_role(organization_id, array['owner','admin']::public.app_role[]))
with check (public.has_org_role(organization_id, array['owner','admin']::public.app_role[]));

drop policy if exists provider_webhooks_select_member on public.provider_webhooks;
create policy provider_webhooks_select_member
on public.provider_webhooks
for select
using (
  exists (
    select 1
    from public.provider_connections pc
    join public.organization_memberships om
      on om.organization_id = pc.organization_id
    where pc.id = connection_id
      and om.user_id = auth.uid()
  )
);

drop policy if exists provider_webhooks_manage_admin on public.provider_webhooks;
create policy provider_webhooks_manage_admin
on public.provider_webhooks
for all
using (
  exists (
    select 1
    from public.provider_connections pc
    where pc.id = connection_id
      and public.has_org_role(pc.organization_id, array['owner','admin']::public.app_role[])
  )
)
with check (
  exists (
    select 1
    from public.provider_connections pc
    where pc.id = connection_id
      and public.has_org_role(pc.organization_id, array['owner','admin']::public.app_role[])
  )
);

drop policy if exists project_memberships_select_member on public.project_memberships;
create policy project_memberships_select_member
on public.project_memberships
for select
using (public.is_project_member(project_id));

drop policy if exists project_memberships_manage_admin on public.project_memberships;
create policy project_memberships_manage_admin
on public.project_memberships
for all
using (
  exists (
    select 1
    from public.projects p
    where p.id = project_id
      and public.has_org_role(p.organization_id, array['owner','admin']::public.app_role[])
  )
)
with check (
  exists (
    select 1
    from public.projects p
    where p.id = project_id
      and public.has_org_role(p.organization_id, array['owner','admin']::public.app_role[])
  )
);

drop policy if exists project_settings_select_member on public.project_settings;
create policy project_settings_select_member
on public.project_settings
for select
using (public.is_project_member(project_id));

drop policy if exists project_settings_manage_admin on public.project_settings;
create policy project_settings_manage_admin
on public.project_settings
for all
using (
  exists (
    select 1
    from public.projects p
    where p.id = project_id
      and public.has_org_role(p.organization_id, array['owner','admin']::public.app_role[])
  )
)
with check (
  exists (
    select 1
    from public.projects p
    where p.id = project_id
      and public.has_org_role(p.organization_id, array['owner','admin']::public.app_role[])
  )
);

drop policy if exists graph_snapshots_select_member on public.graph_snapshots;
create policy graph_snapshots_select_member
on public.graph_snapshots
for select
using (public.is_org_member(organization_id));

drop policy if exists vulnerability_advisory_cache_service_role on public.vulnerability_advisory_cache;
create policy vulnerability_advisory_cache_service_role
on public.vulnerability_advisory_cache
for all
using (auth.role() = 'service_role')
with check (auth.role() = 'service_role');

drop policy if exists finding_evidence_refs_select_member on public.finding_evidence_refs;
create policy finding_evidence_refs_select_member
on public.finding_evidence_refs
for select
using (
  exists (
    select 1
    from public.findings f
    join public.organization_memberships om
      on om.organization_id = f.organization_id
    where f.id = finding_id
      and om.user_id = auth.uid()
  )
);

drop policy if exists issue_candidate_versions_select_member on public.issue_candidate_versions;
create policy issue_candidate_versions_select_member
on public.issue_candidate_versions
for select
using (
  exists (
    select 1
    from public.issue_candidates ic
    join public.organization_memberships om
      on om.organization_id = ic.organization_id
    where ic.id = issue_candidate_id
      and om.user_id = auth.uid()
  )
);

drop policy if exists issue_validation_results_select_member on public.issue_validation_results;
create policy issue_validation_results_select_member
on public.issue_validation_results
for select
using (
  exists (
    select 1
    from public.issue_candidates ic
    join public.organization_memberships om
      on om.organization_id = ic.organization_id
    where ic.id = issue_candidate_id
      and om.user_id = auth.uid()
  )
);

drop policy if exists rejected_issue_candidate_artifacts_select_member on public.rejected_issue_candidate_artifacts;
create policy rejected_issue_candidate_artifacts_select_member
on public.rejected_issue_candidate_artifacts
for select
using (public.is_org_member(organization_id));

drop policy if exists published_issue_links_select_member on public.published_issue_links;
create policy published_issue_links_select_member
on public.published_issue_links
for select
using (
  exists (
    select 1
    from public.published_issues pi
    join public.organization_memberships om
      on om.organization_id = pi.organization_id
    where pi.id = published_issue_id
      and om.user_id = auth.uid()
  )
);

drop policy if exists issue_sync_logs_select_member on public.issue_sync_logs;
create policy issue_sync_logs_select_member
on public.issue_sync_logs
for select
using (
  exists (
    select 1
    from public.published_issues pi
    join public.organization_memberships om
      on om.organization_id = pi.organization_id
    where pi.id = published_issue_id
      and om.user_id = auth.uid()
  )
);

drop policy if exists reconciliation_events_select_member on public.reconciliation_events;
create policy reconciliation_events_select_member
on public.reconciliation_events
for select
using (public.is_org_member(organization_id));

drop policy if exists review_actions_select_member on public.review_actions;
create policy review_actions_select_member
on public.review_actions
for select
using (
  exists (
    select 1
    from public.issue_candidates ic
    join public.organization_memberships om
      on om.organization_id = ic.organization_id
    where ic.id = issue_candidate_id
      and om.user_id = auth.uid()
  )
);

drop policy if exists audit_run_events_select_member on public.audit_run_events;
create policy audit_run_events_select_member
on public.audit_run_events
for select
using (
  exists (
    select 1
    from public.audit_runs ar
    join public.organization_memberships om
      on om.organization_id = ar.organization_id
    where ar.id = audit_run_id
      and om.user_id = auth.uid()
  )
);

drop policy if exists notifications_select_self on public.notifications;
create policy notifications_select_self
on public.notifications
for select
using (user_id = auth.uid());

drop policy if exists notifications_manage_service_role on public.notifications;
create policy notifications_manage_service_role
on public.notifications
for all
using (auth.role() = 'service_role')
with check (auth.role() = 'service_role');

drop policy if exists activity_events_select_member on public.activity_events;
create policy activity_events_select_member
on public.activity_events
for select
using (public.is_org_member(organization_id));

drop policy if exists organization_api_keys_manage_admin on public.organization_api_keys;
create policy organization_api_keys_manage_admin
on public.organization_api_keys
for all
using (public.has_org_role(organization_id, array['owner','admin']::public.app_role[]))
with check (public.has_org_role(organization_id, array['owner','admin']::public.app_role[]));

drop policy if exists usage_events_select_member on public.usage_events;
create policy usage_events_select_member
on public.usage_events
for select
using (public.is_org_member(organization_id));

