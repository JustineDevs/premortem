import { NextResponse } from 'next/server';

import { getApiBaseUrl } from '@/lib/runtime-config';

export async function POST(request: Request) {
  const response = await fetch(`${getApiBaseUrl()}/api/slack/premortem`, {
    method: 'POST',
    headers: {
      accept: 'application/json',
      'content-type': request.headers.get('content-type') ?? 'application/json',
      'x-slack-signature': request.headers.get('x-slack-signature') ?? '',
      'x-slack-request-timestamp': request.headers.get('x-slack-request-timestamp') ?? ''
    },
    body: await request.text(),
    cache: 'no-store'
  });

  const headers = new Headers(response.headers);
  const requestId = response.headers.get('x-request-id');
  if (requestId) headers.set('x-request-id', requestId);

  return new NextResponse(response.body, {
    status: response.status,
    headers
  });
}
