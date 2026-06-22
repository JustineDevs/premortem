import { createHmac, timingSafeEqual } from 'node:crypto';

export function verifySharedSecretToken(provided: string | null | undefined, expected: string): boolean {
  if (!provided || !expected) return false;
  const providedBuffer = Buffer.from(provided);
  const expectedBuffer = Buffer.from(expected);
  if (providedBuffer.length !== expectedBuffer.length) return false;
  return timingSafeEqual(providedBuffer, expectedBuffer);
}

export function verifyWebhookHmacSha256(
  body: Buffer | string,
  signature: string,
  secret: string,
  prefix = 'sha256='
): boolean {
  if (!secret || !signature) return false;
  const payload = typeof body === 'string' ? Buffer.from(body) : body;
  const expected = prefix + createHmac('sha256', secret).update(payload).digest('hex');
  return verifySharedSecretToken(signature.startsWith(prefix) ? signature : `${prefix}${signature}`, expected);
}
