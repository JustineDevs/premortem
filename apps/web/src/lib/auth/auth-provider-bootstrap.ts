import { isLocalAuthBypassEnabled } from '@premortem/domain';

import { resolveSupabaseRuntimeConfig } from '@/lib/supabase/server-config';

export type AuthProviderBootstrap = {
  configured: boolean;
  mode: string;
  botIdEnabled: boolean;
  botIdConfigured: boolean;
  botIdSiteKey: string;
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
    botIdEnabled: false,
    botIdConfigured: false,
    botIdSiteKey: '',
    supabaseUrl: runtimeConfig.url,
    supabaseAnonKey: runtimeConfig.anonKey
  };
}
