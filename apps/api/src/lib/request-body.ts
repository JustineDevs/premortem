export function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

export async function readJsonRecord(request: Request): Promise<Record<string, unknown> | null> {
  try {
    const body = await request.json();
    return isRecord(body) ? body : null;
  } catch {
    return null;
  }
}

export function readOptionalString(
  body: Record<string, unknown>,
  key: string
): string | undefined {
  const value = body[key];
  return typeof value === 'string' ? value : undefined;
}

export function readRequiredString(
  body: Record<string, unknown>,
  key: string
): string | null {
  const value = readOptionalString(body, key);
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

export function readOptionalBoolean(
  body: Record<string, unknown>,
  key: string
): boolean | undefined {
  const value = body[key];
  return typeof value === 'boolean' ? value : undefined;
}

export function readOptionalStringArray(
  body: Record<string, unknown>,
  key: string
): string[] | null {
  const value = body[key];
  if (!Array.isArray(value)) return null;

  const values = value.filter((entry): entry is string => typeof entry === 'string');
  return values.length === value.length ? values : null;
}

export function readOptionalRecord(
  body: Record<string, unknown>,
  key: string
): Record<string, unknown> | undefined {
  const value = body[key];
  return isRecord(value) ? value : undefined;
}

export function readOptionalStringLiteral<T extends string>(
  body: Record<string, unknown>,
  key: string,
  allowed: readonly T[]
): T | undefined {
  const value = readOptionalString(body, key);
  return value && allowed.includes(value as T) ? (value as T) : undefined;
}
