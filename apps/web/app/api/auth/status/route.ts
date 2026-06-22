import { NextResponse } from 'next/server';

import { isLocalAuthBypassEnabled } from '@premortem/domain';

import { isSupabaseAuthConfigured } from '@/lib/supabase/server-config';
import { bffErrorResponse } from '@/lib/server/bff-errors';
import { hasValidSignedIdentity, resolveRequestActorContext } from '@/lib/server/request-context';
import {
  getTurnstileSiteKey,
  isTurnstileConfigured,
  isTurnstileEnabled
} from '@/lib/server/turnstile';
import { resolveSupabaseRuntimeConfig } from '@/lib/supabase/server-config';

export async function GET(request: Request) {
  try {
    const runtimeConfig = await resolveSupabaseRuntimeConfig();

    if (isLocalAuthBypassEnabled()) {
      const context = await resolveRequestActorContext(request);
      return NextResponse.json({
        configured: await isSupabaseAuthConfigured(),
        authenticated: true,
        mode: 'local_fixture',
        organizationId: context.organizationId,
        captchaEnabled: isTurnstileEnabled(),
        captchaConfigured: isTurnstileConfigured(),
        captchaSiteKey: getTurnstileSiteKey(),
        supabaseUrl: runtimeConfig?.url ?? null,
        supabaseAnonKey: runtimeConfig?.anonKey ?? null
      });
    }

    const signedUserId = request.headers.get('x-user-id')?.trim();
    if (signedUserId && hasValidSignedIdentity(request, signedUserId)) {
      return NextResponse.json({
        configured: await isSupabaseAuthConfigured(),
        authenticated: true,
        mode: 'supabase',
        captchaEnabled: isTurnstileEnabled(),
        captchaConfigured: isTurnstileConfigured(),
        captchaSiteKey: getTurnstileSiteKey(),
        supabaseUrl: runtimeConfig?.url ?? null,
        supabaseAnonKey: runtimeConfig?.anonKey ?? null
      });
    }

    if (!(await isSupabaseAuthConfigured())) {
      return NextResponse.json({
        configured: false,
        authenticated: false,
        mode: 'unconfigured',
        captchaEnabled: isTurnstileEnabled(),
        captchaConfigured: isTurnstileConfigured(),
        captchaSiteKey: getTurnstileSiteKey(),
        supabaseUrl: runtimeConfig?.url ?? null,
        supabaseAnonKey: runtimeConfig?.anonKey ?? null
      });
    }

    try {
      await resolveRequestActorContext(request);
      return NextResponse.json({
        configured: true,
        authenticated: true,
        mode: 'supabase',
        captchaEnabled: isTurnstileEnabled(),
        captchaConfigured: isTurnstileConfigured(),
        captchaSiteKey: getTurnstileSiteKey(),
        supabaseUrl: runtimeConfig?.url ?? null,
        supabaseAnonKey: runtimeConfig?.anonKey ?? null
      });
    } catch {
      return NextResponse.json({
        configured: true,
        authenticated: false,
        mode: 'supabase',
        captchaEnabled: isTurnstileEnabled(),
        captchaConfigured: isTurnstileConfigured(),
        captchaSiteKey: getTurnstileSiteKey(),
        supabaseUrl: runtimeConfig?.url ?? null,
        supabaseAnonKey: runtimeConfig?.anonKey ?? null
      });
    }
  } catch (error) {
    return bffErrorResponse(error, 'Failed to resolve auth status');
  }
}
