import { NextResponse } from 'next/server';

import { isSupabaseAuthConfigured } from '@/lib/supabase/config';

export function GET() {
  return NextResponse.json({
    configured: isSupabaseAuthConfigured()
  });
}
