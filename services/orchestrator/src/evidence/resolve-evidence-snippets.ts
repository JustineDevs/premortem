import { fetchRepositoryFileRaw } from '@premortem/integrations';
import {
  isLikelyRepositoryFilePath,
  isSourceFileEvidence,
  normalizeEvidenceRefs,
  parseFileEvidenceRef,
  type EvidenceRefLike
} from '@premortem/domain';

const MAX_SNIPPET_FETCHES = 8;
const CONTEXT_LINES = 4;
const MAX_SNIPPET_LINES = 18;

function sliceFileWindow(content: string, startLine: number, endLine: number): string {
  const lines = content.split('\n');
  const from = Math.max(startLine - CONTEXT_LINES - 1, 0);
  const to = Math.min(endLine + CONTEXT_LINES, lines.length);
  const slice = lines.slice(from, to);
  if (slice.length > MAX_SNIPPET_LINES) {
    return slice.slice(0, MAX_SNIPPET_LINES).join('\n');
  }

  return slice
    .map((line, index) => {
      const lineNo = from + index + 1;
      const marker = lineNo >= startLine && lineNo <= endLine ? '>' : ' ';
      return `${marker} ${String(lineNo).padStart(4, ' ')} | ${line}`;
    })
    .join('\n');
}

async function fetchSnippetForRef(input: {
  baseUrl: string;
  token: string;
  externalProjectId: string;
  branch: string;
  ref: string;
}): Promise<string | null> {
  const parsed = parseFileEvidenceRef(input.ref);
  if (!parsed || !isLikelyRepositoryFilePath(parsed.filePath)) return null;

  try {
    const raw = await fetchRepositoryFileRaw({
      baseUrl: input.baseUrl,
      token: input.token,
      externalProjectId: input.externalProjectId,
      ref: input.branch,
      filePath: parsed.filePath
    });
    return sliceFileWindow(raw, parsed.startLine, parsed.endLine);
  } catch {
    return null;
  }
}

export async function enrichEvidenceWithSourceSnippets(input: {
  evidence: unknown;
  baseUrl: string;
  token: string;
  externalProjectId: string;
  branch: string;
}): Promise<EvidenceRefLike[]> {
  const normalized = normalizeEvidenceRefs(input.evidence);
  if (normalized.length === 0) return normalized;

  let fetchBudget = MAX_SNIPPET_FETCHES;
  const enriched: EvidenceRefLike[] = [];

  for (const item of normalized) {
    if (item.codeSnippet || !isSourceFileEvidence(item) || fetchBudget <= 0) {
      enriched.push(item);
      continue;
    }

    const snippet = await fetchSnippetForRef({
      baseUrl: input.baseUrl,
      token: input.token,
      externalProjectId: input.externalProjectId,
      branch: input.branch,
      ref: item.ref
    });

    fetchBudget -= 1;
    enriched.push(snippet ? { ...item, codeSnippet: snippet } : item);
  }

  return enriched;
}
