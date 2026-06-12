import { NextResponse } from 'next/server';

import { isLocalAuthBypassEnabled } from '@premortem/domain';

import { isSupabaseAuthConfigured } from '@/lib/supabase/config';
import { bffErrorResponse } from '@/lib/server/bff-errors';
import { resolveRequestActorContext } from '@/lib/server/request-context';

export async function GET(request: Request) {
  try {
    if (isLocalAuthBypassEnabled()) {
      const context = await resolveRequestActorContext(request);
      return NextResponse.json({
        configured: isSupabaseAuthConfigured(),
        authenticated: true,
        mode: 'local_fixture',
        organizationId: context.organizationId
      });
    }

    if (!isSupabaseAuthConfigured()) {
      return NextResponse.json({
        configured: false,
        authenticated: false,
        mode: 'unconfigured'
      });
    }

    try {
      await resolveRequestActorContext(request);
      return NextResponse.json({
        configured: true,
        authenticated: true,
        mode: 'supabase'
      });
    } catch {
      return NextResponse.json({
        configured: true,
        authenticated: false,
        mode: 'supabase'
      });
    }
  } catch (error) {
    return bffErrorResponse(error, 'Failed to resolve auth status');
  }
}
