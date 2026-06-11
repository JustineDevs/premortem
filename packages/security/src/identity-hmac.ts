import { createHmac, timingSafeEqual } from 'node:crypto';

export function signUserId(userId: string, secret: string): string {
  return createHmac('sha256', secret).update(userId).digest('hex');
}

export function verifyUserIdSignature(userId: string, signature: string, secret: string): boolean {
  if (!userId || !signature || !secret) return false;
  const expected = Buffer.from(signUserId(userId, secret));
  const actual = Buffer.from(signature);
  if (expected.length !== actual.length) return false;
  return timingSafeEqual(expected, actual);
}

export function identityHeadersForUser(userId: string, secret?: string): Record<string, string> {
  const headers: Record<string, string> = { 'x-premortem-actor-id': userId };
  if (secret) {
    headers['x-user-id'] = userId;
    headers['x-user-id-sig'] = signUserId(userId, secret);
  }
  return headers;
}

export function rejectSpoofedIdentity(
  userId: string | null | undefined,
  signature: string | null | undefined,
  secret: string | undefined
): boolean {
  if (!secret) return false;
  if (!userId || !signature) return false;
  return !verifyUserIdSignature(userId, signature, secret);
}
