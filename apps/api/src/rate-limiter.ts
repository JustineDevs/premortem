export class RateLimiter {
  constructor(private readonly state: { storage: { get(key: string): Promise<unknown>; put(key: string, value: unknown): Promise<void> } }) {}

  async fetch(request: Request): Promise<Response> {
    if (request.method !== 'POST') {
      return Response.json({ error: 'Method not allowed' }, { status: 405 });
    }

    const body = (await request.json().catch(() => null)) as
      | { key?: string; limit?: number; windowMs?: number }
      | null;

    if (!body?.key || !Number.isFinite(body.limit) || !Number.isFinite(body.windowMs)) {
      return Response.json({ error: 'Invalid rate limit payload' }, { status: 400 });
    }

    const limit = body.limit as number;
    const windowMs = body.windowMs as number;
    const now = Date.now();
    const current = (await this.state.storage.get(body.key)) as
      | { count?: number; resetAt?: number }
      | null
      | undefined;

    const resetAt = typeof current?.resetAt === 'number' ? current.resetAt : 0;
    const count = typeof current?.count === 'number' ? current.count : 0;
    const next = !current || now > resetAt ? { count: 1, resetAt: now + windowMs } : { count: count + 1, resetAt };
    const allowed = next.count <= limit;

    if (allowed) {
      await this.state.storage.put(body.key, next);
    }

    return Response.json({ allowed, count: next.count, resetAt: next.resetAt });
  }
}
