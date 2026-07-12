import { randomUUID } from 'node:crypto';

import { z } from 'zod';

import { createLlmAdapter, discoverLocalLlmProviders, type LlmCustomProviderConfig, type LlmVendorRoutingTierConfig } from '@premortem/llm';
import { getOrganizationLlmSettings, listOrganizationProjects, recordActivityEvent } from '@premortem/db';
import { validateInput, recordAuditStep } from '@premortem/security';

import { readJsonRecord, readOptionalString } from '../lib/request-body';
import { resolveApiActorContext } from '../lib/request-context';
import type { AppEnv } from '../lib/types';

const SandboxEvidenceSchema = z
  .object({
    kind: z.string().optional(),
    ref: z.string().optional(),
    reason: z.string().optional(),
    codeSnippet: z.string().optional()
  })
  .passthrough();

const SandboxFindingSchema = z
  .object({
    finding_id: z.string().optional(),
    category: z.string().min(1),
    severity: z.enum(['critical', 'high', 'medium', 'low']),
    predicted_failure: z
      .object({
        summary: z.string().min(1),
        failure_mode: z.string().optional(),
        trigger_conditions: z.array(z.string()).default([]),
        blast_radius: z.string().optional()
      })
      .passthrough(),
    why_it_matters: z.string().optional(),
    affected_assets: z.array(z.string()).default([]),
    evidence: z.array(SandboxEvidenceSchema).default([]),
    recommended_controls: z.array(z.string()).default([]),
    confidence: z.number().min(0).max(1).optional()
  })
  .passthrough();

const SandboxAuditResponseSchema = z
  .object({
    overallScore: z.number().min(0).max(100),
    findings: z.array(SandboxFindingSchema).default([])
  })
  .passthrough();

type SandboxAuditResponse = z.infer<typeof SandboxAuditResponseSchema>;

type SandboxLlmMessage = {
  role: 'system' | 'user' | 'assistant';
  content: string;
};

type SandboxLlmAdapter = {
  generateObject<T>(input: {
    model: string;
    schema: unknown;
    messages: SandboxLlmMessage[];
    temperature?: number;
    maxOutputTokens?: number;
  }): Promise<{ output: T }>;
};

function numberSnippet(code: string) {
  return code
    .split('\n')
    .map((line, index) => `${String(index + 1).padStart(4, ' ')} | ${line}`)
    .join('\n');
}

function extractJsonText(text: string) {
  const trimmed = text.trim();
  if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
    return trimmed;
  }

  const fenced = trimmed.match(/```(?:json|ts|text)?\s*([\s\S]*?)```/i);
  if (fenced?.[1]) {
    return fenced[1].trim();
  }

  const firstBrace = trimmed.indexOf('{');
  const lastBrace = trimmed.lastIndexOf('}');
  if (firstBrace >= 0 && lastBrace > firstBrace) {
    return trimmed.slice(firstBrace, lastBrace + 1);
  }

  throw new Error('Sandbox provider did not return JSON output.');
}

function severityFromFindingContext(
  summary: string,
  category?: string,
  evidenceRef?: string
): SandboxAuditResponse['findings'][number]['severity'] {
  const normalized = `${summary} ${category ?? ''} ${evidenceRef ?? ''}`.toLowerCase();
  if (
    normalized.includes('sql injection') ||
    normalized.includes('hardcoded') ||
    normalized.includes('aws-style access key')
  ) {
    return 'critical';
  }
  if (
    normalized.includes('credential logging') ||
    normalized.includes('secret exposure') ||
    normalized.includes('plaintext') ||
    normalized.includes('password') ||
    normalized.includes('token')
  ) {
    return 'high';
  }
  if (normalized.includes('http') || normalized.includes('transport')) {
    return 'medium';
  }
  if (normalized.includes('critical')) return 'critical';
  if (normalized.includes('high') || normalized.includes('severe')) return 'high';
  if (normalized.includes('medium') || normalized.includes('moderate')) return 'medium';
  return 'low';
}

function deriveFindingCategory(summary: string): string {
  const normalized = summary.toLowerCase();
  if (normalized.includes('sql')) return 'sql_injection';
  if (normalized.includes('secret') || normalized.includes('credential') || normalized.includes('password')) {
    return 'secret_exposure';
  }
  if (normalized.includes('http') || normalized.includes('plaintext') || normalized.includes('transport')) {
    return 'transport_security';
  }
  if (normalized.includes('aws') || normalized.includes('key')) return 'secret_exposure';
  return 'sandbox_issue';
}

type SnippetFindingSeed = {
  category: string;
  severity: SandboxAuditResponse['findings'][number]['severity'];
  summary: string;
  whyItMatters: string;
  recommendation: string;
  evidenceLine: number;
  evidenceReason: string;
  evidenceCodeSnippet: string;
};

function isGenericSandboxFinding(finding: SandboxAuditResponse['findings'][number]): boolean {
  const summary = finding.predicted_failure.summary.trim().toLowerCase();
  return (
    finding.category.trim().toLowerCase() === 'sandbox_issue' ||
    /^sandbox finding \d+$/i.test(summary) ||
    summary.length === 0
  );
}

function lineAt(snippetLines: string[], lineNumber: number): string {
  return snippetLines[Math.max(0, Math.min(snippetLines.length - 1, lineNumber - 1))] ?? '';
}

function makeSnippetSeed(
  snippetLines: string[],
  options: {
    category: string;
    severity: SnippetFindingSeed['severity'];
    summary: string;
    whyItMatters: string;
    recommendation: string;
    evidenceLine: number;
    evidenceReason: string;
  }
): SnippetFindingSeed {
  return {
    ...options,
    evidenceLine: Math.max(1, Math.min(snippetLines.length, options.evidenceLine)),
    evidenceCodeSnippet: lineAt(snippetLines, options.evidenceLine)
  };
}

function detectSnippetFindings(snippet: string): SnippetFindingSeed[] {
  const snippetLines = snippet.split('\n');
  const normalized = snippet.toLowerCase();
  const seeds: SnippetFindingSeed[] = [];

  const sqlLineIndex = snippetLines.findIndex((line) => {
    const lowered = line.toLowerCase();
    return (
      lowered.includes('select') &&
      (lowered.includes('+') || lowered.includes('${')) &&
      (lowered.includes('query') || lowered.includes('execute') || lowered.includes('sql'))
    );
  });
  if (sqlLineIndex >= 0) {
    const queryLine = sqlLineIndex + 1;
    seeds.push(
      makeSnippetSeed(snippetLines, {
        category: 'sql_injection',
        severity: 'critical',
        summary: 'SQL injection risk from unsanitized string concatenation in the query path.',
        whyItMatters:
          'An attacker-controlled value can alter the SQL command, exposing or modifying account data.',
        recommendation: 'Use parameterized queries and add a regression test for attacker-controlled input.',
        evidenceLine: queryLine,
        evidenceReason: 'The query string is composed with concatenation instead of placeholders.'
      })
    );
  }

  const logLineIndex = snippetLines.findIndex((line) => {
    const lowered = line.toLowerCase();
    return lowered.includes('console.log') && (lowered.includes('password') || lowered.includes('secret') || lowered.includes('token'));
  });
  if (logLineIndex >= 0) {
    const logLine = logLineIndex + 1;
    seeds.push(
      makeSnippetSeed(snippetLines, {
        category: 'secret_exposure',
        severity: 'high',
        summary: 'Plaintext credential logging exposes sensitive authentication data.',
        whyItMatters: 'Credentials written to logs can be read by operators, log sinks, or attackers.',
        recommendation: 'Remove secret-bearing logs and replace them with redacted or structured audit events.',
        evidenceLine: logLine,
        evidenceReason: 'The console call prints a password or secret-bearing payload.'
      })
    );
  }

  const httpLineIndex = snippetLines.findIndex((line) => {
    const lowered = line.toLowerCase();
    return lowered.includes('port: 80') || (lowered.includes('http.') && lowered.includes('request'));
  });
  if (httpLineIndex >= 0) {
    const httpLine = httpLineIndex + 1;
    seeds.push(
      makeSnippetSeed(snippetLines, {
        category: 'transport_security',
        severity: 'medium',
        summary: 'Plain HTTP transport exposes data and metadata in transit.',
        whyItMatters: 'Unencrypted transit allows interception or tampering before the request reaches the service.',
        recommendation: 'Move the call to TLS and enforce HTTPS-only transport.',
        evidenceLine: httpLine,
        evidenceReason: 'The request uses a plain HTTP endpoint or port 80.'
      })
    );
  }

  const awsKeyLineIndex = snippetLines.findIndex((line) => /AKIA[0-9A-Z]{8,}/.test(line));
  if (awsKeyLineIndex >= 0) {
    const keyLine = awsKeyLineIndex + 1;
    seeds.push(
      makeSnippetSeed(snippetLines, {
        category: 'secret_exposure',
        severity: 'high',
        summary: 'Hardcoded cloud credential material is present in the source snippet.',
        whyItMatters: 'Static access keys can be reused if the repository, logs, or build artifacts are exposed.',
        recommendation: 'Load credentials from the runtime secret store and rotate any exposed key immediately.',
        evidenceLine: keyLine,
        evidenceReason: 'The source contains an AWS-style access key prefix.'
      })
    );
  }

  if (seeds.length === 0 && normalized.includes('password')) {
    seeds.push(
      makeSnippetSeed(snippetLines, {
        category: 'secret_exposure',
        severity: 'medium',
        summary: 'Sensitive password handling requires review.',
        whyItMatters: 'The snippet references credentials in a way that may not be safe.',
        recommendation: 'Ensure the credential is not stored, logged, or transmitted in plaintext.',
        evidenceLine: 1,
        evidenceReason: 'The snippet mentions password handling.'
      })
    );
  }

  return seeds;
}

function groundGenericSandboxResponse(
  response: SandboxAuditResponse,
  snippet: string
): SandboxAuditResponse {
  const snippetSeeds = detectSnippetFindings(snippet);
  if (snippetSeeds.length === 0) {
    return response;
  }

  const genericOnly =
    response.findings.length === 0 || response.findings.every((finding) => isGenericSandboxFinding(finding));
  if (!genericOnly) {
    return response;
  }

  const groundedFindings = snippetSeeds.map((seed, index) => ({
    finding_id: `sandbox-${index + 1}`,
    category: seed.category,
    severity: seed.severity,
    predicted_failure: {
      summary: seed.summary,
      trigger_conditions: [seed.summary]
    },
    why_it_matters: seed.whyItMatters,
    affected_assets: ['sandbox-snippet.ts'],
    evidence: [
      {
        kind: 'source',
        ref: `sandbox-snippet.ts:${seed.evidenceLine}`,
        reason: seed.evidenceReason,
        codeSnippet: seed.evidenceCodeSnippet
      }
    ],
    recommended_controls: [seed.recommendation],
    confidence: 0.9
  }));

  return {
    overallScore: Math.max(10, 100 - groundedFindings.length * 35),
    findings: groundedFindings
  };
}

function parseSandboxFindingsFromString(rawText: string, snippet: string): SandboxAuditResponse {
  const snippetLineCount = Math.max(1, snippet.split('\n').length);
  const cleaned = rawText
    .replace(/^```(?:json|ts|text)?\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim();

  const bulletCandidates = cleaned
    .split(/\n+/)
    .map((line) =>
      line
        .trim()
        .replace(/^[-*•\d.)\s]+/, '')
        .replace(/^["'`]+|["'`]+$/g, '')
    )
    .filter((line) => line.length > 0);

  const summaries =
    bulletCandidates.length > 0
      ? bulletCandidates
      : cleaned
          .split(/(?<=[.!?])\s+/)
          .map((part) => part.trim())
          .filter((part) => part.length > 0);

  const findings = summaries.map((summary, index) => ({
    finding_id: `sandbox-${index + 1}`,
    category: deriveFindingCategory(summary),
    severity: severityFromFindingContext(summary, deriveFindingCategory(summary)),
    predicted_failure: {
      summary,
      trigger_conditions: [summary]
    },
    affected_assets: ['sandbox-snippet.ts'],
    evidence: [
      {
        kind: 'source',
        ref: `sandbox-snippet.ts:1-${snippetLineCount}`,
        reason: 'Derived from the pasted sandbox snippet.',
        codeSnippet: snippet
      }
    ],
    recommended_controls: [],
    confidence: 0.5
  }));

  return {
    overallScore: findings.length > 0 ? Math.max(10, 100 - findings.length * 18) : 100,
    findings
  };
}

function normalizeSandboxAuditResponse(raw: unknown, snippet: string): SandboxAuditResponse {
  const snippetLineCount = Math.max(1, snippet.split('\n').length);
  if (typeof raw === 'string') {
    try {
      const extracted = extractJsonText(raw);
      return normalizeSandboxAuditResponse(JSON.parse(extracted), snippet);
    } catch {
      return parseSandboxFindingsFromString(raw, snippet);
    }
  }

  const parsed = SandboxAuditResponseSchema.safeParse(raw);
  if (!parsed.success) {
    const fallback = typeof raw === 'object' && raw !== null ? (raw as Record<string, unknown>) : {};
    const findings = Array.isArray(fallback.findings) ? fallback.findings : [];
    const normalizedFindings = findings.map((finding, index) => {
      const entry = finding && typeof finding === 'object' ? (finding as Record<string, unknown>) : {};
      const summary =
        typeof finding === 'string'
          ? finding.trim()
          : typeof (finding as Record<string, unknown>).predicted_failure === 'object' &&
              (finding as Record<string, unknown>).predicted_failure !== null &&
              typeof ((finding as Record<string, unknown>).predicted_failure as Record<string, unknown>).summary === 'string'
            ? String(
                ((finding as Record<string, unknown>).predicted_failure as Record<string, unknown>).summary
              ).trim()
            : typeof entry.description === 'string' && entry.description.trim().length > 0
              ? entry.description.trim()
            : typeof (finding as Record<string, unknown>).summary === 'string'
              ? String((finding as Record<string, unknown>).summary).trim()
              : `Sandbox finding ${index + 1}`;

      const recommendation =
        typeof entry.recommendation === 'string' && entry.recommendation.trim().length > 0
          ? entry.recommendation.trim()
          : typeof entry.resolution === 'string' && entry.resolution.trim().length > 0
            ? entry.resolution.trim()
            : summary;

      const evidenceRef =
        typeof entry.evidenceRef === 'string' && entry.evidenceRef.trim().length > 0
          ? entry.evidenceRef.trim()
          : typeof entry.filepath === 'string' && entry.filepath.trim().length > 0
            ? entry.filepath.trim()
            : `sandbox-snippet.ts:1-${snippetLineCount}`;

      return {
        finding_id: `sandbox-${index + 1}`,
        category: deriveFindingCategory(summary),
        severity: severityFromFindingContext(summary, deriveFindingCategory(summary), evidenceRef),
        predicted_failure: {
          summary,
          failure_mode:
            typeof entry.failureMode === 'string' && entry.failureMode.trim().length > 0
              ? entry.failureMode.trim()
              : undefined,
          trigger_conditions: [summary],
          blast_radius:
            typeof entry.blastRadius === 'string' && entry.blastRadius.trim().length > 0
              ? entry.blastRadius.trim()
              : undefined
        },
        why_it_matters:
          typeof entry.whyItMatters === 'string' && entry.whyItMatters.trim().length > 0
            ? entry.whyItMatters.trim()
            : typeof entry.why_it_matters === 'string' && entry.why_it_matters.trim().length > 0
              ? entry.why_it_matters.trim()
              : recommendation,
        affected_assets: ['sandbox-snippet.ts'],
        evidence: [
          {
            kind: 'source',
            ref: evidenceRef,
            reason:
              typeof entry.reason === 'string' && entry.reason.trim().length > 0
                ? entry.reason.trim()
                : 'Derived from the pasted sandbox snippet.',
            codeSnippet: snippet
          }
        ],
        recommended_controls: [recommendation],
        confidence:
          typeof entry.confidence === 'number' && Number.isFinite(entry.confidence)
            ? Math.max(0, Math.min(1, entry.confidence))
            : 0.5
      };
    });

    return {
      overallScore:
        typeof fallback.overallScore === 'number' && Number.isFinite(fallback.overallScore)
          ? Math.max(0, Math.min(100, fallback.overallScore))
          : normalizedFindings.length > 0
            ? 60
            : 100,
      findings: normalizedFindings
    };
  }

    return {
      overallScore:
        typeof parsed.data.overallScore === 'number' && Number.isFinite(parsed.data.overallScore)
          ? Math.max(0, Math.min(100, parsed.data.overallScore))
          : 100,
      findings: Array.isArray(parsed.data.findings)
      ? parsed.data.findings.map((finding, index) => ({
          finding_id:
            typeof finding.finding_id === 'string' && finding.finding_id.trim().length > 0
              ? finding.finding_id.trim()
              : `sandbox-${index + 1}`,
          category:
            typeof finding.category === 'string' && finding.category.trim().length > 0
              ? finding.category.trim()
              : deriveFindingCategory(finding.predicted_failure.summary),
          severity: severityFromFindingContext(
            typeof finding.predicted_failure.summary === 'string' ? finding.predicted_failure.summary : '',
            typeof finding.category === 'string' && finding.category.trim().length > 0
              ? finding.category.trim()
              : deriveFindingCategory(finding.predicted_failure.summary),
            Array.isArray(finding.evidence) && finding.evidence.length > 0 && typeof finding.evidence[0]?.ref === 'string'
              ? String(finding.evidence[0].ref)
              : undefined
          ),
          predicted_failure: {
            summary:
              typeof finding.predicted_failure.summary === 'string' &&
              finding.predicted_failure.summary.trim().length > 0
                ? finding.predicted_failure.summary.trim()
                : `Sandbox finding ${index + 1}`,
            failure_mode:
              typeof finding.predicted_failure.failure_mode === 'string' &&
              finding.predicted_failure.failure_mode.trim().length > 0
                ? finding.predicted_failure.failure_mode.trim()
                : undefined,
            trigger_conditions: Array.isArray(finding.predicted_failure.trigger_conditions)
              ? finding.predicted_failure.trigger_conditions
                  .map((value) => (typeof value === 'string' ? value.trim() : ''))
                  .filter(Boolean)
              : [],
            blast_radius:
              typeof finding.predicted_failure.blast_radius === 'string' &&
              finding.predicted_failure.blast_radius.trim().length > 0
                ? finding.predicted_failure.blast_radius.trim()
                : undefined
          },
          why_it_matters:
            typeof finding.why_it_matters === 'string' && finding.why_it_matters.trim().length > 0
              ? finding.why_it_matters.trim()
              : typeof (finding as Record<string, unknown>).description === 'string' &&
                  String((finding as Record<string, unknown>).description).trim().length > 0
                ? String((finding as Record<string, unknown>).description).trim()
              : undefined,
          affected_assets: Array.isArray(finding.affected_assets)
            ? finding.affected_assets
                .map((value) => (typeof value === 'string' ? value.trim() : ''))
                .filter(Boolean)
            : ['sandbox-snippet.ts'],
          evidence: Array.isArray(finding.evidence)
            ? finding.evidence.map((entry) => ({
                kind:
                  typeof entry?.kind === 'string' && entry.kind.trim().length > 0
                    ? entry.kind.trim()
                    : 'source',
                ref:
                  typeof entry?.ref === 'string' && entry.ref.trim().length > 0
                    ? entry.ref.trim()
                    : typeof (finding as Record<string, unknown>).evidenceRef === 'string' &&
                        String((finding as Record<string, unknown>).evidenceRef).trim().length > 0
                      ? String((finding as Record<string, unknown>).evidenceRef).trim()
                    : `sandbox-snippet.ts:1-${snippetLineCount}`,
                reason:
                  typeof entry?.reason === 'string' && entry.reason.trim().length > 0
                    ? entry.reason.trim()
                    : typeof (finding as Record<string, unknown>).description === 'string' &&
                        String((finding as Record<string, unknown>).description).trim().length > 0
                      ? String((finding as Record<string, unknown>).description).trim()
                      : 'Evidence returned by the sandbox provider.',
                codeSnippet:
                  typeof entry?.codeSnippet === 'string' && entry.codeSnippet.trim().length > 0
                    ? entry.codeSnippet.trim()
                    : snippet
              }))
            : [
                {
                  kind: 'source',
                  ref:
                    typeof (finding as Record<string, unknown>).evidenceRef === 'string' &&
                    String((finding as Record<string, unknown>).evidenceRef).trim().length > 0
                      ? String((finding as Record<string, unknown>).evidenceRef).trim()
                      : `sandbox-snippet.ts:1-${snippetLineCount}`,
                  reason:
                    typeof (finding as Record<string, unknown>).description === 'string' &&
                    String((finding as Record<string, unknown>).description).trim().length > 0
                      ? String((finding as Record<string, unknown>).description).trim()
                      : 'Derived from the pasted sandbox snippet.',
                  codeSnippet: snippet
                }
              ],
          recommended_controls: Array.isArray(finding.recommended_controls)
            ? finding.recommended_controls
                .map((value) => (typeof value === 'string' ? value.trim() : ''))
                .filter(Boolean)
            : typeof (finding as Record<string, unknown>).recommendation === 'string' &&
                String((finding as Record<string, unknown>).recommendation).trim().length > 0
              ? [String((finding as Record<string, unknown>).recommendation).trim()]
            : [],
          confidence:
            typeof finding.confidence === 'number' && Number.isFinite(finding.confidence)
              ? Math.max(0, Math.min(1, finding.confidence))
              : undefined
        }))
      : []
  };
}

async function probeOpenAiCompatibleProvider(provider: LlmCustomProviderConfig): Promise<boolean> {
  try {
    const response = await fetch(`${provider.host.replace(/\/$/, '')}/v1/models`, {
      headers: { accept: 'application/json' },
      cache: 'no-store',
      signal: AbortSignal.timeout(1500)
    });

    return response.ok;
  } catch {
    return false;
  }
}

function isRealProject(project: { repoUrl?: string | null } | null | undefined): boolean {
  return Boolean(project && typeof project.repoUrl === 'string' && project.repoUrl.trim().length > 0);
}

function selectRealProject(
  projects: Array<{ id?: string | number | null; repoUrl?: string | null; branch?: string | null; name?: string | null }> | null | undefined,
  preferredProjectId?: string | null
) {
  const safeProjects = Array.isArray(projects) ? projects : [];
  if (preferredProjectId) {
    const preferred = safeProjects.find((project) => String(project.id) === preferredProjectId);
    if (isRealProject(preferred)) {
      return preferred;
    }
  }

  return safeProjects.find(isRealProject) ?? null;
}

export async function handleSandboxAuditCreate(request: Request) {
  const body = await readJsonRecord(request);
  if (!body) {
    return Response.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const customSnippet = readOptionalString(body, 'customSnippet')?.trim();
  if (!customSnippet) {
    return Response.json({ error: 'customSnippet is required' }, { status: 400 });
  }

  const runId = randomUUID();
  const guard = validateInput(customSnippet);
  let actor;
  try {
    actor = await resolveApiActorContext(request);
  } catch {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (!guard.passed) {
    await recordAuditStep(runId, 'input_guardrail', 'sandbox', 'blocked', guard.violation, async (entry) => {
      await recordActivityEvent({
        organizationId: actor.organizationId,
        actorId: actor.profileId,
        eventType: 'sandbox.audit_step.blocked',
        objectType: 'sandbox_scan',
        objectId: runId,
        summary: `${entry.step} ${entry.status}: ${entry.detail ?? 'blocked'}`
      });
    });
    await recordActivityEvent({
      organizationId: actor.organizationId,
      actorId: actor.profileId,
      eventType: 'sandbox.audit.blocked',
      objectType: 'sandbox_scan',
      objectId: runId,
      summary: `Sandbox audit blocked by input guardrail: ${guard.violation}`
    });
    return Response.json({ error: guard.violation }, { status: 400 });
  }

  await recordAuditStep(runId, 'input_guardrail', 'sandbox', 'passed', undefined, async (entry) => {
    await recordActivityEvent({
      organizationId: actor.organizationId,
      actorId: actor.profileId,
      eventType: 'sandbox.audit_step.passed',
      objectType: 'sandbox_scan',
      objectId: runId,
      summary: `${entry.step} ${entry.status}`
    });
  });

  try {
    const { projects } = await listOrganizationProjects(actor.organizationId, { take: 100 });
    const requestedProjectId = readOptionalString(body, 'projectId')?.trim();
    const selectedProject = requestedProjectId
      ? projects.find((project) => String(project.id) === requestedProjectId && isRealProject(project)) ?? null
      : selectRealProject(projects);

    if (requestedProjectId && !selectedProject) {
      return Response.json(
        { error: 'Select a registered project before running a sandbox audit.' },
        { status: 400 }
      );
    }

    if (!selectedProject?.id) {
      throw new Error('Connect a repository before running a sandbox audit.');
    }

    const projectId = String(selectedProject.id);
    const projectName = selectedProject.name;
    const selectedProjectRef = selectedProject as { branch?: string | null; defaultBranch?: string | null };
    const projectBranch =
      selectedProjectRef.branch?.trim() ||
      selectedProjectRef.defaultBranch?.trim() ||
      readOptionalString(body, 'branch')?.trim() ||
      'main';
    const numberedSnippet = numberSnippet(customSnippet);
    const llmSettings = await getOrganizationLlmSettings(actor.organizationId);
    const sandboxCustomProviders = llmSettings.customProviders ?? [];
    const sandboxVendorRouting: LlmVendorRoutingTierConfig[] = llmSettings.vendorRouting;
    const discoveredLocalProviders = await discoverLocalLlmProviders();
    const reachableActiveProviders = await Promise.all(
      sandboxCustomProviders
        .filter((provider) => provider.active)
        .map(async (provider) => {
          const reachable = await probeOpenAiCompatibleProvider(provider);
          return reachable ? provider : null;
        })
    );
    const reachableCustomProviders = reachableActiveProviders.filter(
      (provider): provider is LlmCustomProviderConfig => provider !== null
    );
    const mergedCustomProviders: LlmCustomProviderConfig[] = [...discoveredLocalProviders];
    for (const discovered of discoveredLocalProviders) {
      const existingIndex = mergedCustomProviders.findIndex(
        (provider) => provider.name === discovered.name || provider.host === discovered.host
      );
      if (existingIndex >= 0) {
        mergedCustomProviders[existingIndex] = {
          ...mergedCustomProviders[existingIndex]!,
          host: discovered.host,
          model: discovered.model,
          active: true
        };
      } else {
        mergedCustomProviders.push(discovered);
      }
    }
    for (const provider of reachableCustomProviders) {
      const existingIndex = mergedCustomProviders.findIndex(
        (entry) => entry.name === provider.name || entry.host === provider.host
      );
      if (existingIndex >= 0) {
        mergedCustomProviders[existingIndex] = {
          ...mergedCustomProviders[existingIndex]!,
          ...provider,
          active: true
        };
      } else {
        mergedCustomProviders.push(provider);
      }
    }
    const staleActiveProviders = sandboxCustomProviders.filter(
      (provider) => provider.active && !mergedCustomProviders.some((entry) => entry.name === provider.name)
    );
    const resolvedVendorRouting: LlmVendorRoutingTierConfig[] = discoveredLocalProviders.length > 0
      ? [
          {
            id: 'sandbox-local-auto-discover',
            label: 'Sandbox local provider',
            description: 'Prefer discovered local providers before cloud fallbacks.',
            kind: 'auto_discover',
            providerRef: 'local',
            enabled: true
          },
          ...sandboxVendorRouting.filter((tier) => tier.kind !== 'auto_discover')
        ]
      : sandboxVendorRouting;
    const llm = createLlmAdapter({
      vendorRouting: resolvedVendorRouting,
      customProviders: mergedCustomProviders
    });
    const sandboxModel = llmSettings.selectedGeminiModel?.trim() || 'gemini-2.5-flash';

    const structuredLlm = llm as unknown as SandboxLlmAdapter;
    const promptMessages = [
      {
        role: 'system' as const,
        content: [
          'You are Premortem Sandbox, a security code reviewer.',
          'Analyze the exact snippet provided in the prompt and return structured findings only.',
          'Do not fabricate file paths. Use sandbox-snippet.ts as the evidence file path when citing the pasted snippet.',
          'Every finding must be grounded in the pasted code and include evidence refs that point to sandbox-snippet.ts line ranges.',
          'If there are no security issues, return an empty findings array and overallScore 100.',
          'Severity must be one of low, medium, high, critical.'
        ].join(' ')
      },
      {
        role: 'user' as const,
        content: [
          `Project: ${projectName}`,
          `Project ID: ${projectId}`,
          `Branch: ${projectBranch}`,
          'Snippet:',
          '```ts',
          numberedSnippet,
          '```'
        ].join('\n')
      }
    ];

    let normalizedOutput: SandboxAuditResponse;
    try {
      const textResult = await llm.generate({
        model: sandboxModel,
        messages: [
          ...promptMessages,
          {
            role: 'user',
            content:
              'Return only strict JSON with keys overallScore and findings. Do not include prose outside JSON.'
          }
        ],
        temperature: 0.1,
        maxOutputTokens: 4096
      });
      normalizedOutput = groundGenericSandboxResponse(
        normalizeSandboxAuditResponse(textResult.text, customSnippet),
        customSnippet
      );
    } catch (textError) {
      try {
        const result = await structuredLlm.generateObject<SandboxAuditResponse>({
          model: sandboxModel,
          schema: SandboxAuditResponseSchema,
          messages: promptMessages
        });
        normalizedOutput = groundGenericSandboxResponse(
          normalizeSandboxAuditResponse(result.output, customSnippet),
          customSnippet
        );
        if (process.env.NODE_ENV !== 'production') {
          console.warn('Sandbox audit fell back to structured output after text generation failure', textError);
        }
      } catch (objectError) {
        throw new Error(
          `Sandbox audit failed to produce structured output. Text fallback: ${
            textError instanceof Error ? textError.message : String(textError)
          }. Object fallback: ${
            objectError instanceof Error ? objectError.message : String(objectError)
          }`
        );
      }
    }

    await recordActivityEvent({
      organizationId: actor.organizationId,
      actorId: actor.profileId,
      eventType: 'sandbox.audit.completed',
      objectType: 'sandbox_scan',
      objectId: runId,
      summary: `Sandbox audit completed for ${projectName} with ${normalizedOutput.findings.length} findings`
    });

    if (staleActiveProviders.length > 0) {
      await recordActivityEvent({
        organizationId: actor.organizationId,
        actorId: actor.profileId,
        eventType: 'sandbox.audit.provider_fallback',
        objectType: 'sandbox_scan',
        objectId: runId,
        summary: `Sandbox local provider unavailable; falling back from ${staleActiveProviders
          .map((provider) => provider.name)
          .join(', ')}`
      });
    }

    return Response.json(
      {
        success: true,
        sandbox: true,
        generatedAt: new Date().toISOString(),
        projectId,
        projectName,
        projectBranch,
        overallScore: normalizedOutput.overallScore,
        findings: normalizedOutput.findings
      },
      { status: 200 }
    );
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Sandbox audit requires a configured LLM provider.';
    await recordActivityEvent({
      organizationId: actor.organizationId,
      actorId: actor.profileId,
      eventType: 'sandbox.audit.failed',
      objectType: 'sandbox_scan',
      objectId: runId,
      summary: message
    });
    if (
      /failed for all configured providers/i.test(message) ||
      /dunning decision is deny|no usable llm provider|configured llm provider/i.test(message)
    ) {
      return Response.json(
        {
          error: message.includes('failed for all configured providers')
            ? message
            : 'No usable LLM provider is currently available. Enable a cloud key or reconnect the active local provider, then retry the sandbox audit.'
        },
        { status: 503 }
      );
    }
    return Response.json(
      {
        error: message
      },
      { status: 503 }
    );
  }
}
