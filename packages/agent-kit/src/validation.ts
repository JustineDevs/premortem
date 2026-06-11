import { ZodError } from 'zod';
import { findingEnvelopeSchema, issueEnvelopeSchema } from './schemas';
import type { CanonicalFinding, IssueCandidate } from './types';

function stripMarkdownFences(text: string) {
  return text
    .trim()
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim();
}

function parseBalancedJsonObject(text: string, start: number) {
  let depth = 0;
  let inString = false;
  let escaped = false;

  for (let index = start; index < text.length; index += 1) {
    const char = text[index];

    if (inString) {
      if (escaped) {
        escaped = false;
      } else if (char === '\\') {
        escaped = true;
      } else if (char === '"') {
        inString = false;
      }
      continue;
    }

    if (char === '"') {
      inString = true;
      continue;
    }

    if (char === '{') {
      depth += 1;
      continue;
    }

    if (char === '}') {
      depth -= 1;
      if (depth === 0) {
        return JSON.parse(text.slice(start, index + 1));
      }
    }
  }

  throw new Error('No complete JSON object found in model response');
}

function parseBalancedJsonArray(text: string, start: number) {
  let depth = 0;
  let inString = false;
  let escaped = false;

  for (let index = start; index < text.length; index += 1) {
    const char = text[index];

    if (inString) {
      if (escaped) {
        escaped = false;
      } else if (char === '\\') {
        escaped = true;
      } else if (char === '"') {
        inString = false;
      }
      continue;
    }

    if (char === '"') {
      inString = true;
      continue;
    }

    if (char === '[') {
      depth += 1;
      continue;
    }

    if (char === ']') {
      depth -= 1;
      if (depth === 0) {
        return JSON.parse(text.slice(start, index + 1));
      }
    }
  }

  throw new Error('No complete JSON array found in model response');
}

function extractJson(text: string, preferredRootKeys: string[] = []) {
  const trimmed = stripMarkdownFences(text);

  try {
    const direct = JSON.parse(trimmed) as unknown;
    if (Array.isArray(direct)) {
      return direct;
    }
    if (direct && typeof direct === 'object') {
      return direct;
    }
  } catch {
    // fall back to scanning partial JSON in noisy model output
  }

  const objects: unknown[] = [];
  const arrays: unknown[] = [];

  for (let index = 0; index < trimmed.length; index += 1) {
    if (trimmed[index] === '{') {
      try {
        objects.push(parseBalancedJsonObject(trimmed, index));
      } catch {
        // keep scanning
      }
    }
    if (trimmed[index] === '[') {
      try {
        arrays.push(parseBalancedJsonArray(trimmed, index));
      } catch {
        // keep scanning
      }
    }
  }

  for (const key of preferredRootKeys) {
    const match = objects.find(
      (value) => value && typeof value === 'object' && key in (value as Record<string, unknown>)
    );
    if (match) return match;
  }

  if (arrays.length > 0) {
    return arrays[0];
  }

  if (objects.length > 0) {
    return objects[0];
  }

  throw new Error('No JSON object found in model response');
}

function normalizeFindingPayload(parsed: unknown) {
  if (Array.isArray(parsed)) {
    return { findings: parsed };
  }

  if (parsed && typeof parsed === 'object') {
    const record = parsed as Record<string, unknown>;
    if (Array.isArray(record.findings)) {
      return record;
    }
    if ('finding_id' in record) {
      return { findings: [record] };
    }
  }

  return parsed;
}

function normalizeIssuePayload(parsed: unknown) {
  if (Array.isArray(parsed)) {
    return { issues: parsed };
  }

  if (parsed && typeof parsed === 'object') {
    const record = parsed as Record<string, unknown>;
    if (Array.isArray(record.issues)) {
      return record;
    }
    if ('title' in record && 'predicted_failure_summary' in record) {
      return { issues: [record] };
    }
  }

  return parsed;
}

export function parseFindingEnvelope(text: string): CanonicalFinding[] {
  try {
    const parsed = normalizeFindingPayload(extractJson(text, ['findings']));
    return findingEnvelopeSchema.parse(parsed).findings as CanonicalFinding[];
  } catch (error) {
    if (error instanceof ZodError) {
      throw new Error(`Finding schema validation failed: ${JSON.stringify(error.issues)}`);
    }
    throw error;
  }
}

export function parseIssueEnvelope(text: string): IssueCandidate[] {
  try {
    const parsed = normalizeIssuePayload(extractJson(text, ['issues']));
    return issueEnvelopeSchema.parse(parsed).issues as IssueCandidate[];
  } catch (error) {
    if (error instanceof ZodError) {
      throw new Error(`Issue schema validation failed: ${JSON.stringify(error.issues)}`);
    }
    throw error;
  }
}
