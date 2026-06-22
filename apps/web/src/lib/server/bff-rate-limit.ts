import { verifyUserIdSignature } from '@premortem/security';

const buckets = new Map<string, { count: number; resetAt: number }>();

const RATE_LIMIT = Number.parseInt(process.env.PREMORTEM_BFF_RATE_LIMIT ?? '120', 10);
const RATE_WINDOW_MS = Number.parseInt(process.env.PREMORTEM_BFF_RATE_WINDOW_MS ?? '60000', 10);

export function checkBffRateLimit(key: string): boolean {
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

export function bffRateLimitKey(request: Request, path: string): string {
  const secret = process.env.IDENTITY_HMAC_SECRET?.trim() ?? null;
  const signedUserId = request.headers.get('x-user-id')?.trim();
  const signature = request.headers.get('x-user-id-sig')?.trim();
  const actor =
    secret &&
    signedUserId &&
    signature &&
    verifyUserIdSignature(signedUserId, signature, secret)
      ? signedUserId
      : request.headers.get('cf-connecting-ip')?.trim() ||
        request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
        'anonymous';
  return `${actor}:${path}`;
}

export function bffRateLimitResponse() {
  return Response.json(
    { error: 'Rate limit exceeded. Retry shortly.', code: 'rate_limited' },
    { status: 429 }
  );
}
