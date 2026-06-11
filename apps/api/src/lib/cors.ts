function normalizeOrigin(value: string | null | undefined) {
  if (!value) return null;
  return value.trim().replace(/\/$/, '');
}

export function configuredCorsOrigin() {
  return normalizeOrigin(process.env.CORS_ORIGIN);
}

export function resolveAllowedOrigin(request: Request): string | null {
  const configured = configuredCorsOrigin();
  if (!configured) return null;

  const requestOrigin = normalizeOrigin(request.headers.get('Origin'));
  if (requestOrigin === configured) {
    return request.headers.get('Origin');
  }

  return null;
}

const CORS_ALLOW_HEADERS =
  'content-type, accept, authorization, x-premortem-actor-id, x-premortem-organization-id, x-premortem-user-email';

export function applyCorsHeaders(response: Response, request: Request): Response {
  const allowedOrigin = resolveAllowedOrigin(request);
  if (!allowedOrigin) return response;

  const headers = new Headers(response.headers);
  headers.set('Access-Control-Allow-Origin', allowedOrigin);
  headers.set('Access-Control-Allow-Credentials', 'true');
  headers.set('Access-Control-Allow-Methods', 'GET, POST, PATCH, PUT, DELETE, OPTIONS');
  headers.set('Access-Control-Allow-Headers', CORS_ALLOW_HEADERS);
  headers.set('Vary', 'Origin');
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers
  });
}

export function corsPreflightResponse(request: Request): Response | null {
  if (request.method !== 'OPTIONS') return null;
  const allowedOrigin = resolveAllowedOrigin(request);
  if (!allowedOrigin) {
    return new Response(null, { status: 204 });
  }
  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': allowedOrigin,
      'Access-Control-Allow-Credentials': 'true',
      'Access-Control-Allow-Methods': 'GET, POST, PATCH, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': CORS_ALLOW_HEADERS,
      'Access-Control-Max-Age': '86400',
      Vary: 'Origin'
    }
  });
}

export async function withCorsRouter(
  request: Request,
  handler: (request: Request) => Promise<Response>
): Promise<Response> {
  const preflight = corsPreflightResponse(request);
  if (preflight) return preflight;

  const response = await handler(request);
  return applyCorsHeaders(response, request);
}
