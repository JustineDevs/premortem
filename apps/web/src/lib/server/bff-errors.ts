import { NextResponse } from 'next/server';

import { actorErrorStatus, parseBffErrorMessage } from '@/lib/bff-messages';

export { actorErrorStatus, parseBffErrorMessage };

export function bffErrorResponse(error: unknown, fallback: string) {
  const message = error instanceof Error ? error.message : fallback;
  return NextResponse.json({ error: message }, { status: actorErrorStatus(error) });
}

export async function readUpstreamJson(response: Response): Promise<unknown> {
  return response.json().catch(() => ({}));
}
