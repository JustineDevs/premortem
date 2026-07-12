export function safeNumber(value: unknown, fallback = 0): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

export function safeText(value: unknown, fallback = 'UNKNOWN'): string {
  return typeof value === 'string' && value.trim().length > 0 ? value : fallback;
}

export function safeUppercase(value: unknown, fallback = 'UNKNOWN'): string {
  return safeText(value, fallback).toUpperCase();
}

export function parseDateValue(value: unknown): Date | null {
  if (typeof value !== 'string' && !(value instanceof Date)) return null;
  const parsed = value instanceof Date ? value : new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export function formatDate(value: unknown, options?: Intl.DateTimeFormatOptions): string {
  const parsed = parseDateValue(value);
  if (!parsed) return 'N/A';
  return options ? parsed.toLocaleDateString(undefined, options) : parsed.toLocaleDateString();
}

export function formatDateTime(value: unknown): string {
  const parsed = parseDateValue(value);
  if (!parsed) return 'N/A';
  return parsed.toLocaleString();
}

export function getAuditRowKey(
  audit: { id?: unknown; projectId?: unknown; date?: unknown },
  index: number
): string {
  const id = safeText(audit.id, '');
  if (id) return id;
  const projectId = safeText(audit.projectId, 'audit');
  const date = safeText(audit.date, String(index));
  return `${projectId}-${date}-${index}`;
}
