alter type public.org_plan add value if not exists 'scale';
alter type public.run_status add value if not exists 'partial';
alter type public.run_status add value if not exists 'paused';
alter type public.publish_sync_status add value if not exists 'drifted';
alter type public.publish_sync_status add value if not exists 'reconciled';

do $$
begin
  if not exists (
    select 1
    from pg_type t
    join pg_namespace n on n.oid = t.typnamespace
    where n.nspname = 'public'
      and t.typname = 'reconciliation_status'
  ) then
    create type public.reconciliation_status as enum ('matched','drifted','failed');
  end if;
end
$$;

alter table public.organizations
  add column if not exists logo_url text,
  add column if not exists website_url text;

alter table public.projects
  add column if not exists connection_id uuid,
  add column if not exists namespace text,
  add column if not exists visibility text,
  add column if not exists created_by_id uuid;

alter table public.audit_runs
  add column if not exists triggered_by_id uuid,
  add column if not exists lease_expires_at timestamptz,
  add column if not exists cancelled_at timestamptz,
  add column if not exists cancel_reason text,
  add column if not exists graph_snapshot_id uuid;

alter table public.agent_runs
  add column if not exists skipped_reason text,
  add column if not exists input_digest text,
  add column if not exists output_digest text,
  add column if not exists prompt_version text,
  add column if not exists model_ref text,
  add column if not exists duration_ms bigint,
  add column if not exists token_usage jsonb not null default '{}'::jsonb;

alter table public.findings
  add column if not exists priority_hint public.priority_level not null default 'p3';

alter table public.issue_candidates
  add column if not exists priority public.priority_level not null default 'p3',
  add column if not exists failure_mode text,
  add column if not exists blast_radius text,
  add column if not exists validation_errors jsonb not null default '[]'::jsonb,
  add column if not exists reviewer_notes text,
  add column if not exists approved_by_id uuid,
  add column if not exists approved_at timestamptz;

alter table public.published_issues
  add column if not exists closed_at timestamptz,
  add column if not exists outcome_type text,
  add column if not exists outcome_notes text,
  add column if not exists outcome_at timestamptz;

create table if not exists public.organization_billing_accounts (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null unique references public.organizations(id) on delete cascade,
  stripe_customer_id text unique,
  stripe_subscription_id text unique,
  plan public.org_plan not null default 'free',
  seats integer not null default 1,
  audit_quota_monthly integer not null default 50,
  audits_used_month integer not null default 0,
  billing_status text,
  current_period_start timestamptz,
  current_period_end timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.stripe_webhook_events (
  id text primary key,
  event_type text not null,
  received_at timestamptz not null default now()
);

create table if not exists public.provider_connections (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  provider public.provider_kind not null,
  external_account_id text,
  external_account_name text,
  installation_ref text,
  access_scope jsonb not null default '{}'::jsonb,
  encrypted_access_token text,
  encrypted_refresh_token text,
  token_expires_at timestamptz,
  nango_connection_id text,
  nango_provider_key text,
  status public.connection_status not null default 'pending',
  created_by_id uuid not null references public.profiles(id),
  last_synced_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, provider, external_account_id)
);

create index if not exists provider_connections_organization_id_idx on public.provider_connections (organization_id);
create index if not exists provider_connections_organization_id_updated_at_idx on public.provider_connections (organization_id, updated_at desc);
create index if not exists provider_connections_organization_id_provider_status_updated_at_idx on public.provider_connections (organization_id, provider, status, updated_at desc);
create index if not exists provider_connections_nango_connection_id_idx on public.provider_connections (nango_connection_id);

create table if not exists public.provider_webhooks (
  id uuid primary key default gen_random_uuid(),
  connection_id uuid not null references public.provider_connections(id) on delete cascade,
  provider public.provider_kind not null,
  external_webhook_id text,
  target_url text,
  status public.connection_status not null default 'pending',
  secret_ref text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.project_memberships (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  role public.app_role not null default 'member',
  created_at timestamptz not null default now(),
  unique (project_id, user_id)
);

create table if not exists public.project_settings (
  project_id uuid primary key references public.projects(id) on delete cascade,
  auto_run_on_push boolean not null default false,
  auto_publish_approved_issues boolean not null default false,
  audit_default_branch_only boolean not null default true,
  enabled_agents jsonb not null default '[]'::jsonb,
  severity_threshold public.severity_level not null default 'medium',
  labels_template jsonb not null default '[]'::jsonb,
  ignore_paths jsonb not null default '[]'::jsonb,
  notification_settings jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.graph_snapshots (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  audit_run_id uuid not null unique references public.audit_runs(id) on delete cascade,
  graph_version text,
  node_count integer not null default 0,
  edge_count integer not null default 0,
  storage_ref text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

alter table public.audit_runs
  add constraint audit_runs_graph_snapshot_id_fkey
  foreign key (graph_snapshot_id) references public.graph_snapshots(id) on delete set null;

create table if not exists public.vulnerability_advisory_cache (
  id text primary key,
  payload jsonb not null,
  epss double precision,
  kev boolean not null default false,
  fetched_at timestamptz not null default now(),
  expires_at timestamptz not null
);

create index if not exists vulnerability_advisory_cache_expires_at_idx on public.vulnerability_advisory_cache (expires_at);

create table if not exists public.finding_evidence_refs (
  id uuid primary key default gen_random_uuid(),
  finding_id uuid not null references public.findings(id) on delete cascade,
  evidence_kind text not null,
  ref text not null,
  reason text not null,
  weight numeric(4,3) not null default 0.5,
  created_at timestamptz not null default now()
);

create index if not exists finding_evidence_refs_finding_id_idx on public.finding_evidence_refs (finding_id);
create index if not exists finding_evidence_refs_ref_idx on public.finding_evidence_refs (ref);

create table if not exists public.issue_candidate_versions (
  id uuid primary key default gen_random_uuid(),
  issue_candidate_id uuid not null references public.issue_candidates(id) on delete cascade,
  version_no integer not null,
  body_snapshot jsonb not null,
  edited_by_id uuid references public.profiles(id),
  edit_reason text,
  created_at timestamptz not null default now(),
  unique (issue_candidate_id, version_no)
);

create table if not exists public.issue_validation_results (
  id uuid primary key default gen_random_uuid(),
  issue_candidate_id uuid not null references public.issue_candidates(id) on delete cascade,
  status public.validation_status not null,
  validator_name text not null default 'issue_validator_agent',
  errors jsonb not null default '[]'::jsonb,
  warnings jsonb not null default '[]'::jsonb,
  score numeric(5,2),
  created_at timestamptz not null default now()
);

create table if not exists public.rejected_issue_candidate_artifacts (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  audit_run_id uuid not null references public.audit_runs(id) on delete cascade,
  cluster_id uuid references public.dedupe_clusters(id) on delete set null,
  title text not null,
  category text not null,
  severity public.severity_level not null,
  confidence numeric(4,3) not null,
  predicted_failure_summary text not null,
  why_it_matters text not null,
  trigger_conditions jsonb not null default '[]'::jsonb,
  evidence jsonb not null default '[]'::jsonb,
  recommended_action_summary text not null,
  implementation_steps jsonb not null default '[]'::jsonb,
  done_criteria jsonb not null default '[]'::jsonb,
  affected_assets jsonb not null default '[]'::jsonb,
  source_agents jsonb not null default '[]'::jsonb,
  source_findings jsonb not null default '[]'::jsonb,
  validation_errors jsonb not null default '[]'::jsonb,
  validation_warnings jsonb not null default '[]'::jsonb,
  validator_name text not null default 'issue_validator_agent',
  created_at timestamptz not null default now()
);

create index if not exists rejected_issue_candidate_artifacts_audit_run_id_idx on public.rejected_issue_candidate_artifacts (audit_run_id);
create index if not exists rejected_issue_candidate_artifacts_project_id_idx on public.rejected_issue_candidate_artifacts (project_id);
create index if not exists rejected_issue_candidate_artifacts_category_idx on public.rejected_issue_candidate_artifacts (category);

create table if not exists public.published_issue_links (
  id uuid primary key default gen_random_uuid(),
  published_issue_id uuid not null references public.published_issues(id) on delete cascade,
  prior_published_issue_id uuid references public.published_issues(id) on delete set null,
  relation_type text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.issue_sync_logs (
  id uuid primary key default gen_random_uuid(),
  published_issue_id uuid not null references public.published_issues(id) on delete cascade,
  action text not null,
  status public.publish_sync_status not null,
  request_payload jsonb not null default '{}'::jsonb,
  response_payload jsonb not null default '{}'::jsonb,
  error_message text,
  created_at timestamptz not null default now()
);

create table if not exists public.reconciliation_events (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  published_issue_id uuid not null references public.published_issues(id) on delete cascade,
  status public.reconciliation_status not null,
  drift_fields jsonb not null default '[]'::jsonb,
  local_snapshot jsonb not null default '{}'::jsonb,
  remote_snapshot jsonb not null default '{}'::jsonb,
  error_message text,
  created_at timestamptz not null default now()
);

create index if not exists reconciliation_events_published_issue_id_idx on public.reconciliation_events (published_issue_id);
create index if not exists reconciliation_events_organization_id_created_at_idx on public.reconciliation_events (organization_id, created_at desc);

create table if not exists public.review_actions (
  id uuid primary key default gen_random_uuid(),
  issue_candidate_id uuid not null references public.issue_candidates(id) on delete cascade,
  actor_id uuid not null references public.profiles(id),
  action_type public.review_action_type not null,
  notes text,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.audit_run_events (
  id uuid primary key default gen_random_uuid(),
  audit_run_id uuid not null references public.audit_runs(id) on delete cascade,
  event_type text not null,
  actor text not null default 'system',
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists audit_run_events_audit_run_id_created_at_idx on public.audit_run_events (audit_run_id, created_at desc);

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  organization_id uuid references public.organizations(id) on delete cascade,
  project_id uuid references public.projects(id) on delete cascade,
  kind public.notification_kind not null,
  title text not null,
  body text,
  url text,
  read_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists notifications_user_id_idx on public.notifications (user_id);
create index if not exists notifications_user_org_created_at_idx on public.notifications (user_id, organization_id, created_at desc);
create index if not exists notifications_user_org_read_at_idx on public.notifications (user_id, organization_id, read_at);
create index if not exists notifications_read_at_idx on public.notifications (read_at);

create table if not exists public.activity_events (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  project_id uuid references public.projects(id) on delete cascade,
  actor_id uuid references public.profiles(id),
  event_type text not null,
  object_type text not null,
  object_id uuid,
  summary text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists activity_events_organization_id_idx on public.activity_events (organization_id);
create index if not exists activity_events_organization_id_created_at_idx on public.activity_events (organization_id, created_at desc);
create index if not exists activity_events_project_id_idx on public.activity_events (project_id);

create table if not exists public.organization_api_keys (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  label text not null,
  key_prefix text not null,
  key_hash text not null,
  created_by_id uuid not null references public.profiles(id),
  last_used_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists organization_api_keys_organization_id_created_at_idx on public.organization_api_keys (organization_id, created_at desc);
create index if not exists organization_api_keys_key_prefix_idx on public.organization_api_keys (key_prefix);

create table if not exists public.usage_events (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  project_id uuid references public.projects(id) on delete set null,
  audit_run_id uuid references public.audit_runs(id) on delete set null,
  event_type text not null,
  quantity numeric(12,2) not null default 1,
  unit text not null default 'count',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists usage_events_organization_id_created_at_idx on public.usage_events (organization_id, created_at desc);
create index if not exists usage_events_organization_id_event_type_created_at_idx on public.usage_events (organization_id, event_type, created_at desc);

create trigger set_organization_billing_accounts_updated_at before update on public.organization_billing_accounts for each row execute function public.set_updated_at();
create trigger set_provider_connections_updated_at before update on public.provider_connections for each row execute function public.set_updated_at();
create trigger set_provider_webhooks_updated_at before update on public.provider_webhooks for each row execute function public.set_updated_at();
create trigger set_project_settings_updated_at before update on public.project_settings for each row execute function public.set_updated_at();
