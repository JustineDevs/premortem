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

function padArray<T>(values: T[], minimumLength: number): T[] {
  if (values.length === 0 || values.length >= minimumLength) {
    return values;
  }

  const padded = [...values];
  while (padded.length < minimumLength) {
    padded.push(padded[padded.length - 1]!);
  }
  return padded;
}

function asStringArray(value: unknown, minimumLength = 0): string[] {
  if (Array.isArray(value)) {
    return padArray(
      value.filter((entry): entry is string => typeof entry === 'string' && entry.length > 0),
      minimumLength
    );
  }

  if (typeof value === 'string' && value.length > 0) {
    return padArray([value], minimumLength);
  }

  return [];
}

function toConfidenceNumber(value: unknown): number {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === 'string') {
    const parsed = Number.parseFloat(value);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }

  return 0;
}

function firstStringAt(value: unknown, index: number): string | undefined {
  if (!Array.isArray(value)) return undefined;
  const candidate = value[index];
  return typeof candidate === 'string' && candidate.length > 0 ? candidate : undefined;
}

function normalizeEvidenceRefs(value: unknown, minimumLength = 0) {
  if (!Array.isArray(value)) {
    if (typeof value === 'string' && value.length > 0) {
      return padArray([
        {
          kind: 'file',
          ref: value,
          reason: 'Referenced by model output'
        }
      ], minimumLength);
    }
    return [];
  }

  return padArray(
    value
    .map((entry) => {
      if (typeof entry === 'string' && entry.length > 0) {
        return {
          kind: 'file',
          ref: entry,
          reason: 'Referenced by model output'
        };
      }

      if (!entry || typeof entry !== 'object') {
        return null;
      }

      const record = entry as Record<string, unknown>;
      const kind = typeof record.kind === 'string' && record.kind.length > 0 ? record.kind : 'file';
      const ref =
        typeof record.ref === 'string' && record.ref.length > 0
          ? record.ref
          : typeof record.path === 'string' && record.path.length > 0
            ? record.path
            : null;
      if (!ref) return null;

      const reason =
        typeof record.reason === 'string' && record.reason.length > 0
          ? record.reason
          : 'Referenced by model output';

      const normalized: Record<string, unknown> = { kind, ref, reason };
      if (typeof record.codeSnippet === 'string' && record.codeSnippet.length > 0) {
        normalized.codeSnippet = record.codeSnippet;
      }

      return normalized;
    })
    .filter((entry): entry is { kind: string; ref: string; reason: string; codeSnippet?: string } => Boolean(entry)),
    minimumLength
  );
}

function normalizeFindingRecord(record: Record<string, unknown>) {
  const finding: Record<string, unknown> = { ...record };
  const primaryAsset =
    firstStringAt(finding.affected_assets, 0) ||
    firstStringAt(finding.dedupe_keys, 0) ||
    (typeof finding.finding_id === 'string' && finding.finding_id) ||
    (typeof finding.category === 'string' && finding.category) ||
    'repository surface';
  const secondaryAsset = firstStringAt(finding.affected_assets, 1) || primaryAsset;
  const predictedFailure = finding.predicted_failure;

  if (typeof predictedFailure === 'string') {
    finding.predicted_failure = {
      summary: predictedFailure,
      trigger_conditions: asStringArray(finding.trigger_conditions).slice(0, 2)
    };
  } else if (predictedFailure && typeof predictedFailure === 'object') {
    const nested: Record<string, unknown> = { ...(predictedFailure as Record<string, unknown>) };
    nested.summary =
      typeof nested.summary === 'string' && nested.summary.length > 0
        ? nested.summary
        : typeof finding.predicted_failure_summary === 'string' && finding.predicted_failure_summary.length > 0
          ? finding.predicted_failure_summary
          : typeof finding.summary === 'string' && finding.summary.length > 0
            ? finding.summary
            : 'Model output did not include a predicted failure summary.';
    nested.trigger_conditions = asStringArray(nested.trigger_conditions, 2);
    finding.predicted_failure = nested;
  } else if (typeof finding.predicted_failure_summary === 'string') {
    finding.predicted_failure = {
      summary: finding.predicted_failure_summary,
      trigger_conditions: asStringArray(finding.trigger_conditions, 2)
    };
  }

  finding.confidence = toConfidenceNumber(finding.confidence);
  finding.affected_assets = asStringArray(finding.affected_assets, 1);
  const normalizedEvidence = normalizeEvidenceRefs(finding.evidence, 2);
  finding.evidence = normalizedEvidence;
  const normalizedRecommendedControls = asStringArray(finding.recommended_controls, 2);
  finding.recommended_controls = normalizedRecommendedControls;
  finding.dedupe_keys = asStringArray(finding.dedupe_keys, 1);
  finding.tags = asStringArray(finding.tags);

  if (typeof finding.why_it_matters !== 'string' && typeof finding.whyItMatters === 'string') {
    finding.why_it_matters = finding.whyItMatters;
  }

  const normalizedPredictedFailure = finding.predicted_failure as Record<string, unknown> | undefined;
  if (!Array.isArray(normalizedPredictedFailure?.trigger_conditions)) {
    const triggerConditions = asStringArray(finding.trigger_conditions, 2);
    finding.predicted_failure = {
      ...(normalizedPredictedFailure ?? {}),
      trigger_conditions: triggerConditions.length >= 2 ? triggerConditions : [...triggerConditions, ...triggerConditions].slice(0, 2)
    };
  }

  if (normalizedEvidence.length === 0) {
    finding.evidence = [
      {
        kind: 'file',
        ref: primaryAsset,
        reason: `Model output omitted evidence; inferred from ${String(finding.category ?? 'the finding')}.`
      },
      {
        kind: 'file',
        ref: secondaryAsset,
        reason: `Model output omitted evidence; inferred from ${String(finding.category ?? 'the finding')}.`
      }
    ];
  }

  if (normalizedRecommendedControls.length === 0) {
    finding.recommended_controls = [
      `Add regression coverage for ${primaryAsset}.`,
      `Review release controls for ${secondaryAsset}.`
    ];
  }

  const normalizedFindingPredictedFailure = finding.predicted_failure as Record<string, unknown> | undefined;
  if (normalizedFindingPredictedFailure && Array.isArray(normalizedFindingPredictedFailure.trigger_conditions)) {
    const triggerConditions = normalizedFindingPredictedFailure.trigger_conditions.filter(
      (entry): entry is string => typeof entry === 'string' && entry.length > 0
    );
    if (triggerConditions.length === 0) {
      normalizedFindingPredictedFailure.trigger_conditions = [
        `Changes to ${primaryAsset} still bypass a critical ${String(finding.category ?? 'delivery')} control.`,
        `The same gap reaches ${secondaryAsset} without a regression gate.`
      ];
    }
  }

  return finding;
}

function normalizeIssueRecord(record: Record<string, unknown>) {
  const issue: Record<string, unknown> = { ...record };
  const primaryAsset =
    firstStringAt(issue.affected_assets, 0) ||
    firstStringAt(issue.source_findings, 0) ||
    (typeof issue.category === 'string' && issue.category) ||
    'repository surface';
  const secondaryAsset = firstStringAt(issue.affected_assets, 1) || primaryAsset;

  issue.confidence = toConfidenceNumber(issue.confidence);
  const normalizedTriggerConditions = asStringArray(issue.trigger_conditions, 2);
  issue.trigger_conditions = normalizedTriggerConditions;
  const normalizedEvidence = normalizeEvidenceRefs(issue.evidence, 2);
  issue.evidence = normalizedEvidence;
  const normalizedImplementationSteps = asStringArray(issue.implementation_steps, 2);
  issue.implementation_steps = normalizedImplementationSteps;
  const normalizedDoneCriteria = asStringArray(issue.done_criteria, 2);
  issue.done_criteria = normalizedDoneCriteria;
  const normalizedAffectedAssets = asStringArray(issue.affected_assets, 1);
  issue.affected_assets = normalizedAffectedAssets;
  const normalizedSourceAgents = asStringArray(issue.source_agents, 1);
  issue.source_agents = normalizedSourceAgents;
  const normalizedSourceFindings = asStringArray(issue.source_findings, 1);
  issue.source_findings = normalizedSourceFindings;

  if (typeof issue.why_it_matters !== 'string' && typeof issue.whyItMatters === 'string') {
    issue.why_it_matters = issue.whyItMatters;
  }

  if (typeof issue.recommended_action_summary !== 'string' && typeof issue.recommendedActionSummary === 'string') {
    issue.recommended_action_summary = issue.recommendedActionSummary;
  }

  if (typeof issue.predicted_failure_summary !== 'string' && typeof issue.predictedFailureSummary === 'string') {
    issue.predicted_failure_summary = issue.predictedFailureSummary;
  }

  if (normalizedTriggerConditions.length === 0) {
    issue.trigger_conditions = [
      `Changes to ${primaryAsset} can still reach review without a gate.`,
      `The ${String(issue.category ?? 'delivery')} path still lacks a safe rollback check.`
    ];
  }

  if (normalizedEvidence.length === 0) {
    issue.evidence = [
      {
        kind: 'finding',
        ref: primaryAsset,
        reason: `Model output omitted evidence; inferred from ${String(issue.category ?? 'the issue')}.`
      },
      {
        kind: 'finding',
        ref: secondaryAsset,
        reason: `Model output omitted evidence; inferred from ${String(issue.category ?? 'the issue')}.`
      }
    ];
  }

  if (normalizedImplementationSteps.length === 0) {
    issue.implementation_steps = [
      `Inspect ${primaryAsset} for the missing control.`,
      `Add regression coverage around ${secondaryAsset}.`
    ];
  }

  if (normalizedDoneCriteria.length === 0) {
    issue.done_criteria = [
      `The ${String(issue.category ?? 'issue')} path is covered by a regression check.`,
      `Reviewers can verify the control before publish.`
    ];
  }

  if (normalizedAffectedAssets.length === 0) {
    issue.affected_assets = [primaryAsset];
  }

  if (normalizedSourceAgents.length === 0) {
    issue.source_agents = ['finding_synthesizer_agent'];
  }

  if (normalizedSourceFindings.length === 0) {
    issue.source_findings = [primaryAsset];
  }

  return issue;
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
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      const record = parsed as { findings?: unknown[] };
      if (Array.isArray(record.findings)) {
        (parsed as { findings: unknown[] }).findings = record.findings.map((finding) =>
          finding && typeof finding === 'object' ? normalizeFindingRecord(finding as Record<string, unknown>) : finding
        );
      }
    }
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
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      const record = parsed as { issues?: unknown[] };
      if (Array.isArray(record.issues)) {
        (parsed as { issues: unknown[] }).issues = record.issues.map((issue) =>
          issue && typeof issue === 'object' ? normalizeIssueRecord(issue as Record<string, unknown>) : issue
        );
      }
    }
    return issueEnvelopeSchema.parse(parsed).issues as IssueCandidate[];
  } catch (error) {
    if (error instanceof ZodError) {
      throw new Error(`Issue schema validation failed: ${JSON.stringify(error.issues)}`);
    }
    throw error;
  }
}
