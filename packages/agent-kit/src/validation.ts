import { ZodError } from 'zod';
import { findingEnvelopeSchema, issueEnvelopeSchema } from './schemas';
import type { CanonicalFinding, IssueCandidate } from './types';

function extractJson(text: string) {
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start === -1 || end === -1) throw new Error('No JSON object found in model response');
  return JSON.parse(text.slice(start, end + 1));
}

export function parseFindingEnvelope(text: string): CanonicalFinding[] {
  try {
    const parsed = extractJson(text);
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
    const parsed = extractJson(text);
    return issueEnvelopeSchema.parse(parsed).issues as IssueCandidate[];
  } catch (error) {
    if (error instanceof ZodError) {
      throw new Error(`Issue schema validation failed: ${JSON.stringify(error.issues)}`);
    }
    throw error;
  }
}
