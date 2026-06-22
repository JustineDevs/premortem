alter table if exists public.published_issues
  add column if not exists outcome_type text,
  add column if not exists outcome_notes text,
  add column if not exists outcome_at timestamptz;
