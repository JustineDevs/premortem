import { NextResponse } from 'next/server';

import { getApiBaseUrl } from '@/lib/runtime-config';

export async function POST(request: Request) {
  const secret = process.env.GITLAB_WEBHOOK_SECRET?.trim();
  if (!secret) {
    return NextResponse.json({ error: 'GitLab webhook is not configured' }, { status: 503 });
  }

  const token = request.headers.get('x-gitlab-token');
  if (!token || token !== secret) {
    return NextResponse.json({ error: 'Invalid GitLab webhook token' }, { status: 401 });
  }

  const body = await request.text();

  try {
    const response = await fetch(`${getApiBaseUrl()}/api/webhooks/gitlab`, {
      method: 'POST',
      headers: {
        accept: 'application/json',
        'content-type': 'application/json',
        'x-gitlab-token': token
      },
      body,
      cache: 'no-store'
    });

    const payload = await response.json().catch(() => ({ error: 'Invalid upstream response' }));
    return NextResponse.json(payload, { status: response.status });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'GitLab webhook proxy failed' },
      { status: 502 }
    );
  }
}
