alter type public.notification_kind add value if not exists 'critical_finding';

alter table public.provider_connections
  add column if not exists nango_connection_id text,
  add column if not exists nango_provider_key text;

create index if not exists provider_connections_nango_connection_id_idx
  on public.provider_connections (nango_connection_id);
