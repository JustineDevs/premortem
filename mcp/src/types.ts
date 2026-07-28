import type { AppRole } from '@premortem/db';
import type { AuditJob } from '@premortem/workflow';

export type PremortemActorSource = 'supabase' | 'api-key' | 'local';

export interface PremortemMcpActorContext {
  profileId: string;
  organizationId: string;
  role: AppRole;
  email?: string | null;
  source: PremortemActorSource;
}

export interface PremortemMcpRuntimeEnv {
  AUDIT_QUEUE?: {
    send(message: AuditJob): Promise<void>;
  };
  PREMORTEM_REPO_ROOT?: string;
}
