import { verifySharedSecretToken } from '@premortem/security';

import { getApiBaseUrl } from '@/lib/runtime-config';
import { bffErrorResponse } from '@/lib/server/bff-errors';

function isValidWebhookToken(provided: string | null, expected: string) {
  return verifySharedSecretToken(provided, expected);
}

export async function POST(request: Request) {
  const secret = process.env.GITLAB_WEBHOOK_SECRET?.trim();
  if (!secret) {
    return new Response(JSON.stringify({ error: 'GitLab webhook is not configured' }), {
      status: 503,
      headers: { 'content-type': 'application/json' }
    });
  }

  const token = request.headers.get('x-gitlab-token');
  if (!isValidWebhookToken(token, secret)) {
    return new Response(JSON.stringify({ error: 'Invalid GitLab webhook token' }), {
      status: 401,
      headers: { 'content-type': 'application/json' }
    });
  }

  const body = await request.text();

  try {
    const response = await fetch(`${getApiBaseUrl()}/api/webhooks/gitlab`, {
      method: 'POST',
      headers: {
        accept: 'application/json',
        'content-type': 'application/json',
        'x-gitlab-token': token!
      },
      body,
      cache: 'no-store'
    });
    return new Response(response.body, {
      status: response.status,
      headers: response.headers
    });
  } catch (error) {
    return bffErrorResponse(error, 'GitLab webhook proxy failed');
  }
}
