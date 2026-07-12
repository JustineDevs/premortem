import { NextResponse } from 'next/server';

import { isLocalAuthBypassEnabled } from '@premortem/domain';

import { bffErrorResponse } from '@/lib/server/bff-errors';
import { resolveRequestActorContext } from '@/lib/server/request-context';
import { resolveSupabaseRuntimeConfig } from '@/lib/supabase/server-config';

export async function GET(request: Request) {
  try {
    const runtimeConfig = await resolveSupabaseRuntimeConfig();

    if (isLocalAuthBypassEnabled()) {
      const context = await resolveRequestActorContext(request);
      return NextResponse.json({
        configured: true,
        authenticated: true,
        mode: 'local_fixture',
        organizationId: context.organizationId,
        botIdEnabled: false,
        botIdConfigured: false,
        botIdSiteKey: null,
        supabaseUrl: runtimeConfig.url,
        supabaseAnonKey: runtimeConfig.anonKey
      });
    }

    try {
      const context = await resolveRequestActorContext(request);
      return NextResponse.json({
        configured: true,
        authenticated: true,
        mode: 'supabase',
        organizationId: context.organizationId,
        botIdEnabled: false,
        botIdConfigured: false,
        botIdSiteKey: null,
        supabaseUrl: runtimeConfig.url,
        supabaseAnonKey: runtimeConfig.anonKey
      });
    } catch {
      return NextResponse.json({
        configured: true,
        authenticated: false,
        mode: 'supabase',
        organizationId: null,
        botIdEnabled: false,
        botIdConfigured: false,
        botIdSiteKey: null,
        supabaseUrl: runtimeConfig.url,
        supabaseAnonKey: runtimeConfig.anonKey
      });
    }
  } catch (error) {
    return bffErrorResponse(error, 'Failed to resolve auth status');
  }
}
