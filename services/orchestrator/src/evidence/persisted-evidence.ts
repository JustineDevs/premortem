import type { EvidenceRefLike } from '@premortem/domain';

/**
 * Normalize evidence loaded from persisted runtime snapshots while preserving code snippets.
 *
 * Historical audit and reconciliation rows can carry snippet-enriched refs. The read model must
 * keep that snippet payload intact so older snapshots do not collapse into bare file refs.
 */
export function normalizePersistedEvidenceRefs(raw: unknown): EvidenceRefLike[] {
  if (!Array.isArray(raw)) {
    return [];
  }

  const normalized: EvidenceRefLike[] = [];
  for (const entry of raw) {
    if (!entry || typeof entry !== 'object') {
      continue;
    }

    const record = entry as Record<string, unknown>;
    const kind = typeof record.kind === 'string' && record.kind.trim().length > 0 ? record.kind.trim() : 'file';
    const ref =
      typeof record.ref === 'string' && record.ref.trim().length > 0
        ? record.ref.trim()
        : typeof record.path === 'string' && record.path.trim().length > 0
          ? record.path.trim()
          : '';

    if (!ref) {
      continue;
    }

    const reason =
      typeof record.reason === 'string' && record.reason.trim().length >= 4
        ? record.reason.trim()
        : 'Evidence loaded from persisted finding record.';
    const codeSnippet =
      typeof record.codeSnippet === 'string' && record.codeSnippet.trim().length > 0
        ? record.codeSnippet.trim()
        : undefined;

    normalized.push({
      kind,
      ref,
      reason,
      ...(codeSnippet ? { codeSnippet } : {})
    });
  }

  return normalized;
}
