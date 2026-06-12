import crypto from 'node:crypto';

const buckets = new Map<string, { count: number; resetAt: number }>();

const RATE_LIMIT = Number.parseInt(process.env.PREMORTEM_API_RATE_LIMIT ?? '180', 10);
const RATE_WINDOW_MS = Number.parseInt(process.env.PREMORTEM_API_RATE_WINDOW_MS ?? '60000', 10);

export function resolveRequestId(request: Request): string {
  return request.headers.get('x-request-id')?.trim() || crypto.randomUUID();
}

async function checkRateLimitWithDurableObject(
  env: { RATE_LIMITER?: { idFromName(name: string): unknown; get(id: unknown): { fetch(request: Request): Promise<Response> } } },
  key: string
): Promise<boolean | null> {
  if (!env.RATE_LIMITER) return null;

  const limiterId = env.RATE_LIMITER.idFromName(key);
  const response = await env.RATE_LIMITER.get(limiterId).fetch(
    new Request('https://premortem.internal/rate-limit/check', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        key,
        limit: RATE_LIMIT,
        windowMs: RATE_WINDOW_MS
      })
    })
  );

  if (!response.ok) {
    return null;
  }

  const payload = (await response.json().catch(() => null)) as { allowed?: boolean } | null;
  if (typeof payload?.allowed === 'boolean') {
    return payload.allowed;
  }

  return null;
}

export async function checkRateLimit(
  key: string,
  env?: { RATE_LIMITER?: { idFromName(name: string): unknown; get(id: unknown): { fetch(request: Request): Promise<Response> } } }
): Promise<boolean> {
  const durableObjectDecision = await checkRateLimitWithDurableObject(env ?? {}, key);
  if (typeof durableObjectDecision === 'boolean') {
    return durableObjectDecision;
  }

  const now = Date.now();
  const entry = buckets.get(key);
  if (!entry || now > entry.resetAt) {
    buckets.set(key, { count: 1, resetAt: now + RATE_WINDOW_MS });
    return true;
  }
  if (entry.count >= RATE_LIMIT) return false;
  entry.count += 1;
  return true;
}

export function rateLimitKey(request: Request, pathname: string): string {
  const actor =
    request.headers.get('x-premortem-actor-id')?.trim() ||
    request.headers.get('cf-connecting-ip')?.trim() ||
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
