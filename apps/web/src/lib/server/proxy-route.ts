import { ConsoleReviewAction } from '@premortem/domain';

import { proxyPremortemApi, proxyPremortemApiRaw } from '@/lib/server/proxy-api';
import { getApiBaseUrl } from '@/lib/runtime-config';
import { verifyBotId } from '@/lib/server/botid';

const RAW_PROXY_PATHS = new Set([
  '/api/stripe/webhook',
  '/api/webhooks/gitlab',
  '/api/slack/events',
  '/api/slack/premortem'
]);

function isUnsafeMethod(method: string) {
  return method !== 'GET' && method !== 'HEAD' && method !== 'OPTIONS';
}

function forwardableHeaders(headers: Headers) {
  const forwarded = new Headers(headers);
  for (const header of [
    'host',
    'content-length',
    'connection',
    'keep-alive',
    'proxy-authenticate',
    'proxy-authorization',
    'te',
    'trailer',
    'transfer-encoding',
    'upgrade',
    'accept-encoding'
  ]) {
    forwarded.delete(header);
  }
  return forwarded;
}

async function proxy(request: Request) {
  const url = new URL(request.url);
  if (request.method.toUpperCase() === 'OPTIONS') {
    const origin = request.headers.get('origin');
    const requestHeaders = request.headers.get('access-control-request-headers');
    const responseHeaders = new Headers();
    responseHeaders.set('vary', 'origin, access-control-request-method, access-control-request-headers');
    responseHeaders.set('access-control-allow-methods', 'GET,HEAD,POST,PUT,PATCH,DELETE,OPTIONS');
    responseHeaders.set('access-control-allow-headers', requestHeaders ?? 'authorization,content-type,x-requested-with');
    responseHeaders.set('access-control-allow-credentials', 'true');
    responseHeaders.set('access-control-max-age', '86400');
    responseHeaders.set('access-control-allow-origin', origin ?? '*');
    return new Response(null, { status: 204, headers: responseHeaders });
  }
  if (url.pathname === '/api/health') {
    try {
      const response = await fetch(`${getApiBaseUrl()}/health`, {
        method: request.method.toUpperCase(),
        headers: forwardableHeaders(request.headers),
        body:
          request.method.toUpperCase() === 'GET' || request.method.toUpperCase() === 'HEAD'
            ? undefined
            : await request.clone().arrayBuffer()
      });

      if (response.ok) {
        return response;
      }

      const payload = await response.json().catch(() => ({}));
      return Response.json(
        {
          ok: true,
          service: 'premortem-web',
          mode: 'nextjs',
          backendHealthy: false,
          backendStatus: response.status,
          backendError: payload?.error ?? 'backend_unavailable',
          apiBaseUrl: getApiBaseUrl()
        },
        { status: 200 }
      );
    } catch (error) {
      return Response.json(
        {
          ok: true,
          service: 'premortem-web',
          mode: 'nextjs',
          backendHealthy: false,
          backendStatus: 503,
          backendError: error instanceof Error ? error.message : 'backend_unavailable',
          apiBaseUrl: getApiBaseUrl()
        },
        { status: 200 }
      );
    }
  }
  let nestedIssueRoute: string | null = null;
  let nestedIssueActionBody: Record<string, unknown> | null = null;
  if (url.pathname.startsWith('/api/audits/') && url.pathname.includes('/issues/') && url.pathname.endsWith('/action')) {
    const bodyText = request.method === 'GET' || request.method === 'HEAD' ? '' : await request.clone().text();
    if (bodyText) {
      try {
        nestedIssueActionBody = JSON.parse(bodyText) as Record<string, unknown>;
      } catch {
        nestedIssueActionBody = null;
      }
    }

    const action = nestedIssueActionBody?.action;
    if (action === ConsoleReviewAction.MERGE) {
      nestedIssueRoute = 'merge';
    } else if (action === ConsoleReviewAction.SPLIT) {
      nestedIssueRoute = 'split';
    } else if (action === ConsoleReviewAction.PUBLISH) {
      nestedIssueRoute = 'publish';
    } else if (action === ConsoleReviewAction.DEFER) {
      nestedIssueRoute = 'edit';
      nestedIssueActionBody = {
        ...nestedIssueActionBody,
        deferred: true
      };
    } else if (action === ConsoleReviewAction.DISMISS) {
      nestedIssueRoute = 'reject';
    } else {
      nestedIssueRoute = 'approve';
    }
  }
  const path =
    url.pathname === '/api/audits/run'
        ? `/api/audits${url.search}`
        : nestedIssueRoute
          ? url.pathname.replace(
              /^\/api\/audits\/([^/]+)\/issues\/([^/]+)\/action$/,
              (_match, _auditId, issueId) => `/api/issues/${issueId}/${nestedIssueRoute}`
            )
          : url.pathname.endsWith('/edit') && url.pathname.includes('/api/audits/')
            ? url.pathname.replace(
                /^\/api\/audits\/([^/]+)\/issues\/([^/]+)\/edit$/,
                (_match, _auditId, issueId) => `/api/issues/${issueId}/edit`
              )
        : `${url.pathname}${url.search}`;
  const method = request.method.toUpperCase();
  const body =
    method === 'GET' || method === 'HEAD'
      ? undefined
      : nestedIssueActionBody
        ? new TextEncoder().encode(JSON.stringify(nestedIssueActionBody))
        : await request.clone().arrayBuffer();

  if (RAW_PROXY_PATHS.has(url.pathname)) {
    return proxyPremortemApiRaw(path, {
      method,
      headers: forwardableHeaders(request.headers),
      body
    });
  }

  if (isUnsafeMethod(method)) {
    const verification = await verifyBotId(request);
    if (verification.isBot) {
      return Response.json({ error: 'Access denied' }, { status: 403 });
    }
  }

  return proxyPremortemApi(
    path,
    {
      method,
      headers: new Headers(request.headers),
      body
    },
    request
  );
}

export async function GET(request: Request) {
  return proxy(request);
}

export async function HEAD(request: Request) {
  return proxy(request);
}

export async function POST(request: Request) {
  return proxy(request);
}

export async function PUT(request: Request) {
  return proxy(request);
}

export async function PATCH(request: Request) {
  return proxy(request);
}

export async function DELETE(request: Request) {
  return proxy(request);
}

export async function OPTIONS(request: Request) {
  return proxy(request);
}
