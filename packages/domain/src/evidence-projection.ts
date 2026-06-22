export interface EvidenceRefLike {
  kind: string;
  ref: string;
  reason: string;
  codeSnippet?: string;
}

export interface ParsedFileEvidenceRef {
  filePath: string;
  startLine: number;
  endLine: number;
}

const CODE_EVIDENCE_KINDS = new Set(['code', 'file', 'schema', 'config', 'source']);

export function normalizeEvidenceRefs(raw: unknown): EvidenceRefLike[] {
  if (!Array.isArray(raw)) return [];
  const normalized: EvidenceRefLike[] = [];

  for (const entry of raw) {
    if (!entry || typeof entry !== 'object') continue;
    const row = entry as Record<string, unknown>;
    const kind = typeof row.kind === 'string' ? row.kind.trim() : 'evidence';
    const ref =
      typeof row.ref === 'string' && row.ref.trim().length > 0
        ? row.ref.trim()
        : typeof row.path === 'string' && row.path.trim().length > 0
          ? row.path.trim()
          : typeof row.filePath === 'string' && row.filePath.trim().length > 0
            ? row.filePath.trim()
            : '';
    const reason = typeof row.reason === 'string' ? row.reason.trim() : '';
    const codeSnippet = typeof row.codeSnippet === 'string' ? row.codeSnippet.trim() : undefined;
    if (!ref && !reason && !codeSnippet) continue;
    normalized.push({ kind, ref, reason, codeSnippet });
  }

  return normalized;
}

export function parseFileEvidenceRef(ref: string): ParsedFileEvidenceRef | null {
  const trimmed = ref.trim();
  if (!trimmed) return null;

  let pathPart = trimmed;
  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
    try {
      const url = new URL(trimmed);
      pathPart = url.pathname.startsWith('/') ? url.pathname.slice(1) : url.pathname;
      if (pathPart.endsWith('/-')) {
        pathPart = pathPart.slice(0, -2);
      }
      if (pathPart.includes('/-/blob/')) {
        const segments = pathPart.split('/-/blob/');
        pathPart = segments[1]?.includes('/') ? segments[1].split('/').slice(1).join('/') : pathPart;
      }
    } catch {
      return null;
    }
  }

  if (pathPart.startsWith('gitlab://') || pathPart.startsWith('repo://')) {
    return null;
  }

  const lastColon = pathPart.lastIndexOf(':');
  if (lastColon > 0 && lastColon < pathPart.length - 1) {
    const filePath = pathPart.slice(0, lastColon);
    const lineRange = pathPart.slice(lastColon + 1);
    let dashIndex = -1;
    for (let index = 0; index < lineRange.length; index += 1) {
      if (lineRange[index] === '-') {
        dashIndex = index;
        break;
      }
    }

    const startLineText = dashIndex >= 0 ? lineRange.slice(0, dashIndex) : lineRange;
    const endLineText = dashIndex >= 0 ? lineRange.slice(dashIndex + 1) : '';
    const startLine = Number.parseInt(startLineText, 10);
    const endLine = endLineText ? Number.parseInt(endLineText, 10) : startLine;
    if (Number.isFinite(startLine) && startLine >= 1) {
      return {
        filePath,
        startLine,
        endLine: Number.isFinite(endLine) && endLine >= startLine ? endLine : startLine
      };
    }
  }

  if (!pathPart.includes('.') || pathPart.includes(' ')) {
    return null;
  }

  return { filePath: pathPart, startLine: 1, endLine: 1 };
}

/** Rejects hidden directory paths like `.husky` that are not repository files. */
export function isLikelyRepositoryFilePath(filePath: string): boolean {
  let normalized = filePath.trim();
  while (normalized.endsWith('/')) {
    normalized = normalized.slice(0, -1);
  }
  if (!normalized) return false;

  const segments = normalized.split('/');
  if (segments.some((segment) => segment.startsWith('.'))) {
    return false;
  }

  const basename = normalized.split('/').pop() ?? '';
  if (basename.startsWith('.') && !basename.slice(1).includes('.')) {
    return false;
  }

  return true;
}

export function isSourceFileEvidence(item: EvidenceRefLike): boolean {
  if (item.codeSnippet) return true;
  if (!CODE_EVIDENCE_KINDS.has(item.kind.toLowerCase())) {
    return Boolean(parseFileEvidenceRef(item.ref));
  }
  return Boolean(parseFileEvidenceRef(item.ref));
}

export function primaryEvidenceLocation(evidence: EvidenceRefLike[]): { filepath: string; line: number } {
  for (const item of evidence) {
    const parsed = parseFileEvidenceRef(item.ref);
    if (parsed) {
      return { filepath: parsed.filePath, line: parsed.startLine };
    }
  }

  const assetPath = evidence.find((item) => parseFileEvidenceRef(item.ref))?.ref;
  if (assetPath) {
    const parsed = parseFileEvidenceRef(assetPath);
    if (parsed) return { filepath: parsed.filePath, line: parsed.startLine };
  }

  return { filepath: 'repository', line: 0 };
}

function formatEvidenceBlock(item: EvidenceRefLike, index: number): string {
  const header = `[${index + 1}] ${item.kind.toUpperCase()} · ${item.ref}`;
  if (item.codeSnippet) {
    return `${header}\n${item.reason ? `${item.reason}\n` : ''}${item.codeSnippet}`;
  }
  return item.reason ? `${header}\n${item.reason}` : header;
}

export function formatSourceCodeEvidence(evidence: EvidenceRefLike[]): string {
  const sourceItems = evidence.filter(isSourceFileEvidence);
  const items = sourceItems.length > 0 ? sourceItems : evidence;
  if (items.length === 0) {
    return 'No structured evidence refs were attached to this issue.';
  }

  return items.map(formatEvidenceBlock).join('\n\n');
}

export function buildTraceFromEvidence(evidence: EvidenceRefLike[]): Array<{
  step: number;
  description: string;
  location: string;
  codeSnippet?: string;
}> {
  if (evidence.length === 0) return [];

  return evidence.map((item, index) => {
    const parsed = parseFileEvidenceRef(item.ref);
    const location = parsed ? `${parsed.filePath}:${parsed.startLine}` : item.ref;
    return {
      step: index + 1,
      description: item.reason || `${item.kind} reference`,
      location,
      codeSnippet: item.codeSnippet
    };
  });
}

export function formatRecommendedPatch(input: {
  recommendedActionSummary?: string;
  implementationSteps?: string[];
  recommendedControls?: string[];
}): string | undefined {
  const steps = (input.implementationSteps ?? []).filter(Boolean);
  const controls = (input.recommendedControls ?? []).filter(Boolean);
  const parts: string[] = [];

  if (input.recommendedActionSummary?.trim()) {
    parts.push(input.recommendedActionSummary.trim());
  }

  if (steps.length > 0) {
    parts.push(steps.map((step, index) => `${index + 1}. ${step}`).join('\n'));
  }

  if (controls.length > 0) {
    parts.push(controls.map((control) => `- ${control}`).join('\n'));
  }

  const combined = parts.join('\n\n').trim();
  return combined || undefined;
}
