import { readJsonRecord } from './lib/request-body';

export class RateLimiter {
  constructor(private readonly state: { storage: { get(key: string): Promise<unknown>; put(key: string, value: unknown): Promise<void> } }) {}

  async fetch(request: Request): Promise<Response> {
    if (request.method !== 'POST') {
      return Response.json({ error: 'Method not allowed' }, { status: 405 });
    }

    const body = (await readJsonRecord(request)) ?? {};

    const key = typeof body.key === 'string' ? body.key.trim() : '';
    const limit = Number(body.limit);
    const windowMs = Number(body.windowMs);

    if (!key || !Number.isFinite(limit) || !Number.isFinite(windowMs)) {
      return Response.json({ error: 'Invalid rate limit payload' }, { status: 400 });
    }

    const now = Date.now();
    const current = (await this.state.storage.get(key)) as
      | { count?: number; resetAt?: number }
      | null
      | undefined;

    const resetAt = typeof current?.resetAt === 'number' ? current.resetAt : 0;
    const count = typeof current?.count === 'number' ? current.count : 0;
    const next = !current || now > resetAt ? { count: 1, resetAt: now + windowMs } : { count: count + 1, resetAt };
    const allowed = next.count <= limit;

    if (allowed) {
      await this.state.storage.put(key, next);
    }

    return Response.json({ allowed, count: next.count, resetAt: next.resetAt });
  }
}
