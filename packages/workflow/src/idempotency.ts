export function makeIdempotencyKey(parts: Array<string | undefined>) {
  return parts.filter(Boolean).join(':');
}
