import { gitLabAuthHeaders } from '@premortem/integrations';
import {
  isLikelyRepositoryFilePath,
  isSourceFileEvidence,
  normalizeEvidenceRefs,
  parseFileEvidenceRef,
  type EvidenceRefLike
} from '@premortem/domain';

const MAX_SNIPPET_FETCHES = 8;
const MAX_CONCURRENT_SNIPPET_FETCHES = 4;
const SNIPPET_FETCH_TIMEOUT_MS = 4_000;
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
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), SNIPPET_FETCH_TIMEOUT_MS);
    try {
      const response = await fetch(
        `${input.baseUrl.replace(/\/$/, '')}/api/v4/projects/${encodeURIComponent(input.externalProjectId)}/repository/files/${encodeURIComponent(parsed.filePath)}/raw?ref=${encodeURIComponent(input.branch)}`,
        {
          headers: gitLabAuthHeaders(input.token),
          signal: controller.signal
        }
      );
      if (!response.ok) return null;
      const raw = await response.text();
      return sliceFileWindow(raw, parsed.startLine, parsed.endLine);
    } finally {
      clearTimeout(timer);
    }
  } catch {
    return null;
  }
}

async function mapWithConcurrency<T, R>(
  items: T[],
  limit: number,
  mapper: (item: T, index: number) => Promise<R>
): Promise<R[]> {
  if (items.length === 0) return [];

  const results = new Array<R>(items.length);
  let nextIndex = 0;

  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (nextIndex < items.length) {
      const currentIndex = nextIndex;
      nextIndex += 1;
      results[currentIndex] = await mapper(items[currentIndex]!, currentIndex);
    }
  });

  await Promise.all(workers);
  return results;
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

  const fetchBudget = Math.min(MAX_SNIPPET_FETCHES, normalized.length);
  const cache = new Map<string, Promise<string | null>>();
  const fetchableItems = normalized
    .map((item, index) => ({ item, index }))
    .filter(({ item }) => !item.codeSnippet && isSourceFileEvidence(item));

  const budgetedItems = fetchableItems.slice(0, fetchBudget);
  const resolvedSnippets = new Map<string, string | null>();

  await mapWithConcurrency(
    budgetedItems,
    MAX_CONCURRENT_SNIPPET_FETCHES,
    async ({ item }) => {
      const cacheKey = item.ref;
      if (!cache.has(cacheKey)) {
        cache.set(
          cacheKey,
          fetchSnippetForRef({
            baseUrl: input.baseUrl,
            token: input.token,
            externalProjectId: input.externalProjectId,
            branch: input.branch,
            ref: item.ref
          })
        );
      }

      resolvedSnippets.set(cacheKey, await cache.get(cacheKey)!);
    }
  );

  return normalized.map((item) => {
    if (item.codeSnippet || !isSourceFileEvidence(item)) {
      return item;
    }

    const snippet = resolvedSnippets.get(item.ref);
    return snippet ? { ...item, codeSnippet: snippet } : item;
  });
}
