export function parseBffErrorMessage(payload: unknown, fallback: string): string {
  if (!payload || typeof payload !== 'object') return fallback;
  const record = payload as Record<string, unknown>;
  if (typeof record.error === 'string' && record.error.trim()) {
    return record.error;
  }
  if (typeof record.message === 'string' && record.message.trim()) {
    return record.message;
  }
  return fallback;
}

export function actorErrorStatus(error: unknown): number {
  if (!(error instanceof Error)) return 502;
  const status = (error as Error & { status?: unknown }).status;
  if (typeof status === 'number' && Number.isFinite(status) && status >= 400 && status <= 599) {
    return status;
  }
  if (error.message === 'Unauthorized') return 401;
  if (error.message === 'Supabase auth is not configured') return 503;
  return 502;
}
