type ThrottleState = {
  count: number;
  resetAt: number;
};

const throttleState = new Map<string, ThrottleState>();

export interface LoginThrottleOptions {
  limit?: number;
  windowMs?: number;
}

export function checkLoginThrottle(key: string, options?: LoginThrottleOptions): {
  allowed: boolean;
  remaining: number;
  resetAt: number;
} {
  const limit = options?.limit ?? 5;
  const windowMs = options?.windowMs ?? 10 * 60_000;
  const now = Date.now();
  const current = throttleState.get(key);

  if (!current || now > current.resetAt) {
    const resetAt = now + windowMs;
    throttleState.set(key, { count: 1, resetAt });
    return { allowed: true, remaining: limit - 1, resetAt };
  }

  const nextCount = current.count + 1;
  const allowed = nextCount <= limit;
  if (allowed) {
    throttleState.set(key, { count: nextCount, resetAt: current.resetAt });
  }

  return {
    allowed,
    remaining: Math.max(0, limit - nextCount),
    resetAt: current.resetAt
  };
}

export function clearLoginThrottleStateForTests(): void {
  throttleState.clear();
}
