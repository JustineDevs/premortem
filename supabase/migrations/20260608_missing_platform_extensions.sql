create table if not exists public.idempotency_keys (
  id uuid primary key default gen_random_uuid(),
  scope text not null,
  idem_key text not null unique,
  status text not null default 'processing',
  response_payload jsonb,
  expires_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.run_leases (
  id uuid primary key default gen_random_uuid(),
  audit_run_id uuid references public.audit_runs(id) on delete cascade,
  leased_by text not null,
  leased_until timestamptz not null,
  created_at timestamptz not null default now(),
  unique (audit_run_id)
);

create table if not exists public.dead_letter_jobs (
  id uuid primary key default gen_random_uuid(),
  queue_name text not null,
  reason text not null,
  payload jsonb not null default '{}'::jsonb,
  failed_at timestamptz not null default now(),
  replayed_at timestamptz
);

create table if not exists public.prompt_versions (
  id uuid primary key default gen_random_uuid(),
  agent_name text not null,
  version text not null,
  prompt_body text not null,
  rollout_percent integer not null default 100,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (agent_name, version)
);

create table if not exists public.agent_feedback (
  id uuid primary key default gen_random_uuid(),
  issue_candidate_id uuid references public.issue_candidates(id) on delete cascade,
  feedback_type text not null,
  notes text,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now()
);

create table if not exists public.audit_cost_events (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations(id) on delete cascade,
  audit_run_id uuid references public.audit_runs(id) on delete set null,
  provider text not null,
  metric_name text not null,
  quantity numeric(12,2) not null default 0,
  unit text not null,
  created_at timestamptz not null default now()
);
