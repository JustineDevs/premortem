import { isLocalAuthBypassEnabled } from '@premortem/domain';

import { resolveSupabaseRuntimeConfig } from '@/lib/supabase/server-config';
import { isBotIdConfigured, isBotIdEnabled } from '@/lib/server/botid';

export type AuthProviderBootstrap = {
  configured: boolean;
  mode: string;
  botIdEnabled: boolean;
  botIdConfigured: boolean;
  supabaseUrl: string;
  supabaseAnonKey: string;
};

export async function getAuthProviderBootstrap(): Promise<AuthProviderBootstrap> {
  const configured = true;
  const mode = isLocalAuthBypassEnabled() ? 'local_fixture' : 'supabase';
  const runtimeConfig = isLocalAuthBypassEnabled()
    ? { url: '', anonKey: '' }
    : await resolveSupabaseRuntimeConfig();

  return {
    configured,
    mode,
    botIdEnabled: isBotIdEnabled(),
    botIdConfigured: isBotIdConfigured(),
    supabaseUrl: runtimeConfig.url,
    supabaseAnonKey: runtimeConfig.anonKey
  };
}
