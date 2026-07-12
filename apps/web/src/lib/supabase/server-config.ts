// @ts-ignore Next/Vercel resolves this through the app webpack pipeline.
import {
  readSupabaseRuntimeConfig,
  requireSupabaseRuntimeConfig,
  type SupabaseRuntimeConfig
} from './config';

function readFromProcessEnv(): SupabaseRuntimeConfig | null {
  return readSupabaseRuntimeConfig(process.env as Record<string, unknown>);
}

export async function resolveSupabaseRuntimeConfig(): Promise<SupabaseRuntimeConfig> {
  const fromProcessEnv = readFromProcessEnv();
  if (fromProcessEnv) {
    return fromProcessEnv;
  }

  return requireSupabaseRuntimeConfig(process.env as Record<string, unknown>);
}

export async function isSupabaseAuthConfigured() {
  await resolveSupabaseRuntimeConfig();
  return true;
}
