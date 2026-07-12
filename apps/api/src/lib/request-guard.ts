import crypto from 'node:crypto';

const RATE_LIMIT = Number.parseInt(process.env.PREMORTEM_API_RATE_LIMIT ?? '180', 10);
const RATE_WINDOW_MS = Number.parseInt(process.env.PREMORTEM_API_RATE_WINDOW_MS ?? '60000', 10);
const localRateLimitState = new Map<string, { count: number; resetAt: number }>();

export function resolveRequestId(request: Request): string {
  return request.headers.get('x-request-id')?.trim() || crypto.randomUUID();
}

export async function checkRateLimit(
  key: string,
  env?: { RATE_LIMITER?: { limit(input: { key: string; limit?: number; windowMs?: number }): Promise<{ allowed?: boolean; success?: boolean }> } }
): Promise<boolean> {
  if (env?.RATE_LIMITER) {
    const result = await env.RATE_LIMITER.limit({
      key,
      limit: RATE_LIMIT,
      windowMs: RATE_WINDOW_MS
    });

    if (typeof result.allowed === 'boolean') {
      return result.allowed;
    }
    if (typeof result.success === 'boolean') {
      return result.success;
    }
  }

  const now = Date.now();
  const current = localRateLimitState.get(key);
  if (!current || now > current.resetAt) {
    localRateLimitState.set(key, { count: 1, resetAt: now + RATE_WINDOW_MS });
    return true;
  }

  const nextCount = current.count + 1;
  const allowed = nextCount <= RATE_LIMIT;
  if (allowed) {
    localRateLimitState.set(key, { count: nextCount, resetAt: current.resetAt });
  }
  return allowed;
}

export function rateLimitKey(request: Request, pathname: string): string {
  const actor =
    request.headers.get('x-premortem-actor-id')?.trim() ||
    request.headers.get('x-user-id')?.trim() ||
    request.headers.get('cf-connecting-ip')?.trim() ||
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    'anonymous';
  return `${actor}:${pathname}`;
}

export function attachRequestId(response: Response, requestId: string): Response {
  const headers = new Headers(response.headers);
  headers.set('x-request-id', requestId);
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers
  });
}
