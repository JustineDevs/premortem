create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, full_name, avatar_url)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'full_name', ''),
    new.raw_user_meta_data ->> 'avatar_url'
  )
  on conflict (id) do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

create or replace function public.is_org_member(org_id uuid)
returns boolean
language sql
stable
as $$
  select exists (
    select 1
    from public.organization_memberships om
    where om.organization_id = org_id
      and om.user_id = auth.uid()
  );
$$;

create or replace function public.has_org_role(org_id uuid, allowed_roles public.app_role[])
returns boolean
language sql
stable
as $$
  select exists (
    select 1
    from public.organization_memberships om
    where om.organization_id = org_id
      and om.user_id = auth.uid()
      and om.role = any (allowed_roles)
  );
$$;

alter table public.profiles enable row level security;
alter table public.organizations enable row level security;
alter table public.organization_memberships enable row level security;
alter table public.projects enable row level security;
alter table public.audit_runs enable row level security;
alter table public.agent_runs enable row level security;
alter table public.findings enable row level security;
alter table public.dedupe_clusters enable row level security;
alter table public.dedupe_cluster_members enable row level security;
alter table public.issue_candidates enable row level security;
alter table public.published_issues enable row level security;

create policy "profiles_select_self"
on public.profiles for select
using (id = auth.uid());

create policy "profiles_update_self"
on public.profiles for update
using (id = auth.uid());

create policy "organizations_select_member"
on public.organizations for select
using (public.is_org_member(id));

create policy "organizations_update_admin"
on public.organizations for update
using (public.has_org_role(id, array['owner','admin']::public.app_role[]));

create policy "memberships_select_member"
on public.organization_memberships for select
using (public.is_org_member(organization_id));

create policy "memberships_manage_admin"
on public.organization_memberships for all
using (public.has_org_role(organization_id, array['owner','admin']::public.app_role[]));

create policy "projects_select_member"
on public.projects for select
using (public.is_org_member(organization_id));

create policy "projects_manage_member_admin"
on public.projects for all
using (public.has_org_role(organization_id, array['owner','admin','member']::public.app_role[]));

create policy "audit_runs_select_member"
on public.audit_runs for select
using (public.is_org_member(organization_id));

create policy "findings_select_member"
on public.findings for select
using (public.is_org_member(organization_id));

create policy "clusters_select_member"
on public.dedupe_clusters for select
using (public.is_org_member(organization_id));

create policy "issue_candidates_select_member"
on public.issue_candidates for select
using (public.is_org_member(organization_id));

create policy "published_issues_select_member"
on public.published_issues for select
using (public.is_org_member(organization_id));
