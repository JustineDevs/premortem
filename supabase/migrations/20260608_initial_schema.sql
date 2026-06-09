create extension if not exists pgcrypto;
create extension if not exists citext;

create type public.app_role as enum ('owner','admin','member','viewer','billing');
create type public.org_plan as enum ('free','pro','team','enterprise');
create type public.provider_kind as enum ('gitlab','github');
create type public.connection_status as enum ('pending','active','revoked','failed');
create type public.project_status as enum ('active','archived','disconnected');
create type public.audit_trigger_source as enum ('manual','webhook','scheduled','api');
create type public.run_status as enum ('queued','running','completed','failed','cancelled','skipped');
create type public.agent_run_mode as enum ('always','conditional');
create type public.finding_status as enum ('active','merged','rejected','superseded');
create type public.severity_level as enum ('low','medium','high','critical');
create type public.priority_level as enum ('p4','p3','p2','p1');
create type public.cluster_merge_status as enum ('open','synthesized','rejected');
create type public.validation_status as enum ('pending','passed','failed');
create type public.review_status as enum ('pending','approved','rejected','edited');
create type public.review_action_type as enum ('approve','reject','edit','merge','split','publish','unpublish');
create type public.publish_sync_status as enum ('pending','created','updated','closed','failed');
create type public.notification_kind as enum ('audit_completed','audit_failed','issues_ready','issue_published','member_invited','billing_notice');
create type public.invitation_status as enum ('pending','accepted','expired','revoked');

create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table public.profiles (
  id uuid primary key,
  email citext unique,
  username citext unique,
  full_name text,
  avatar_url text,
  bio text,
  timezone text default 'UTC',
  onboarding_completed boolean not null default false,
  default_org_id uuid,
  last_seen_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug citext not null unique,
  plan public.org_plan not null default 'free',
  billing_email citext,
  metadata jsonb not null default '{}'::jsonb,
  created_by uuid not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.organization_memberships (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  role public.app_role not null default 'member',
  joined_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique (organization_id, user_id)
);

create table public.projects (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  provider public.provider_kind not null default 'gitlab',
  external_project_id text not null,
  name text not null,
  slug citext not null,
  repo_url text,
  default_branch text default 'main',
  status public.project_status not null default 'active',
  settings jsonb not null default '{}'::jsonb,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (provider, external_project_id),
  unique (organization_id, slug)
);

create table public.audit_runs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  branch text not null,
  commit_sha text,
  trigger_source public.audit_trigger_source not null default 'manual',
  run_status public.run_status not null default 'queued',
  started_at timestamptz,
  completed_at timestamptz,
  duration_ms bigint,
  summary jsonb not null default '{}'::jsonb,
  error_message text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.agent_runs (
  id uuid primary key default gen_random_uuid(),
  audit_run_id uuid not null references public.audit_runs(id) on delete cascade,
  agent_name text not null,
  run_mode public.agent_run_mode not null,
  status public.run_status not null default 'queued',
  raw_output jsonb,
  error_message text,
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.findings (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  audit_run_id uuid not null references public.audit_runs(id) on delete cascade,
  agent_run_id uuid not null references public.agent_runs(id) on delete cascade,
  finding_key text not null,
  category text not null,
  finding_type text not null,
  severity public.severity_level not null,
  confidence numeric(4,3) not null check (confidence >= 0 and confidence <= 1),
  blast_radius text,
  predicted_failure_summary text not null,
  failure_mode text,
  why_it_matters text,
  trigger_conditions jsonb not null default '[]'::jsonb,
  affected_assets jsonb not null default '[]'::jsonb,
  evidence jsonb not null default '[]'::jsonb,
  recommended_controls jsonb not null default '[]'::jsonb,
  dedupe_keys jsonb not null default '[]'::jsonb,
  tags jsonb not null default '[]'::jsonb,
  status public.finding_status not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (audit_run_id, finding_key)
);

create table public.dedupe_clusters (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  audit_run_id uuid not null references public.audit_runs(id) on delete cascade,
  cluster_key text not null,
  category_owner text not null,
  title_hint text,
  merge_status public.cluster_merge_status not null default 'open',
  severity public.severity_level not null,
  confidence numeric(4,3) not null check (confidence >= 0 and confidence <= 1),
  blast_radius text,
  asset_scope jsonb not null default '[]'::jsonb,
  trigger_signature jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (audit_run_id, cluster_key)
);

create table public.dedupe_cluster_members (
  id uuid primary key default gen_random_uuid(),
  cluster_id uuid not null references public.dedupe_clusters(id) on delete cascade,
  finding_id uuid not null references public.findings(id) on delete cascade,
  role text not null default 'supporting',
  similarity_score numeric(4,3) not null default 0.5 check (similarity_score >= 0 and similarity_score <= 1),
  created_at timestamptz not null default now(),
  unique (cluster_id, finding_id)
);

create table public.issue_candidates (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  audit_run_id uuid not null references public.audit_runs(id) on delete cascade,
  cluster_id uuid not null references public.dedupe_clusters(id) on delete cascade,
  title text not null,
  category text not null,
  severity public.severity_level not null,
  confidence numeric(4,3) not null check (confidence >= 0 and confidence <= 1),
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
  validation_status public.validation_status not null default 'pending',
  reviewer_status public.review_status not null default 'pending',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.published_issues (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  issue_candidate_id uuid not null unique references public.issue_candidates(id) on delete cascade,
  provider public.provider_kind not null default 'gitlab',
  external_issue_id text,
  external_issue_iid text,
  url text,
  sync_status public.publish_sync_status not null default 'pending',
  published_title text not null,
  published_body_md text not null,
  labels jsonb not null default '[]'::jsonb,
  published_at timestamptz,
  last_synced_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.profiles add constraint profiles_default_org_id_fkey foreign key (default_org_id) references public.organizations(id) on delete set null;
alter table public.organizations add constraint organizations_created_by_fkey foreign key (created_by) references public.profiles(id);

create index idx_audit_runs_project_id on public.audit_runs(project_id);
create index idx_findings_audit_run_id on public.findings(audit_run_id);
create index idx_dedupe_clusters_audit_run_id on public.dedupe_clusters(audit_run_id);
create index idx_issue_candidates_audit_run_id on public.issue_candidates(audit_run_id);

create trigger set_profiles_updated_at before update on public.profiles for each row execute function public.set_updated_at();
create trigger set_organizations_updated_at before update on public.organizations for each row execute function public.set_updated_at();
create trigger set_projects_updated_at before update on public.projects for each row execute function public.set_updated_at();
create trigger set_audit_runs_updated_at before update on public.audit_runs for each row execute function public.set_updated_at();
create trigger set_findings_updated_at before update on public.findings for each row execute function public.set_updated_at();
create trigger set_dedupe_clusters_updated_at before update on public.dedupe_clusters for each row execute function public.set_updated_at();
create trigger set_issue_candidates_updated_at before update on public.issue_candidates for each row execute function public.set_updated_at();
create trigger set_published_issues_updated_at before update on public.published_issues for each row execute function public.set_updated_at();
