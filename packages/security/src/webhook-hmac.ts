import { createHmac, timingSafeEqual } from 'node:crypto';

export function verifyWebhookHmacSha256(
  body: Buffer | string,
  signature: string,
  secret: string,
  prefix = 'sha256='
): boolean {
  if (!secret || !signature) return false;
  const payload = typeof body === 'string' ? Buffer.from(body) : body;
  const expected = prefix + createHmac('sha256', secret).update(payload).digest('hex');
  const expectedBuf = Buffer.from(expected);
  const actualBuf = Buffer.from(signature.startsWith(prefix) ? signature : `${prefix}${signature}`);
  if (expectedBuf.length !== actualBuf.length) return false;
  return timingSafeEqual(expectedBuf, actualBuf);
}
