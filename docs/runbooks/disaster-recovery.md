# Disaster recovery

- Restore Postgres backups.
- Rebuild Neo4j graph snapshots from retained source artifacts.
- Reconcile GitLab published issues after restore.
- Replay dead-letter audit jobs where safe.
- Validate Supabase auth trigger and RLS migration state.
