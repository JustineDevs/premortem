const repoRoot = '.';

function evidenceText(evidence) {
  return evidence.map((item) => `${item.ref} :: ${item.reason}`).join('\n');
}

function toIssueFromFinding(finding, sourceAgentOverride) {
  return {
    title:
      finding.predicted_failure?.summary?.slice(0, 120) ||
      `Issue candidate for ${finding.category}`,
    category: finding.category,
    severity: finding.severity,
    confidence: finding.confidence,
    predicted_failure_summary:
      finding.predicted_failure?.summary || `Predicted failure for ${finding.category}.`,
    why_it_matters:
      finding.why_it_matters || `The ${finding.category} signal can break production behavior.`,
    trigger_conditions: finding.predicted_failure?.trigger_conditions ?? [],
    evidence: finding.evidence ?? [],
    recommended_action_summary:
      finding.recommended_controls?.[0] ||
      `Reduce the ${finding.category} risk at the server boundary.`,
    implementation_steps:
      finding.recommended_controls?.slice(0, 2) ?? ['Tighten the control surface.', 'Add a regression test.'],
    done_criteria: [
      'The fix is enforced in the relevant route or worker.',
      'A regression test proves the unsafe path no longer passes.'
    ],
    affected_assets: finding.affected_assets ?? [],
    source_agents: [sourceAgentOverride ?? finding.agent].filter(Boolean),
    source_findings: [finding.finding_id].filter(Boolean)
  };
}

function toIssueFromCandidate(candidate) {
  return {
    title: candidate.title,
    category: candidate.category,
    severity: candidate.severity,
    confidence: candidate.confidence,
    predicted_failure_summary: candidate.predicted_failure_summary,
    why_it_matters: candidate.why_it_matters,
    trigger_conditions: candidate.trigger_conditions ?? [],
    evidence: candidate.evidence ?? [],
    recommended_action_summary: candidate.recommended_action_summary,
    implementation_steps: candidate.implementation_steps ?? [],
    done_criteria: candidate.done_criteria ?? [],
    affected_assets: candidate.affected_assets ?? [],
    source_agents: candidate.source_agents ?? [],
    source_findings: candidate.source_findings ?? []
  };
}

function buildGroundingContext(issue) {
  const evidence = issue.evidence ?? [];
  return [
    `Title: ${issue.title}`,
    `Category: ${issue.category}`,
    `Why it matters: ${issue.why_it_matters}`,
    `Predicted failure: ${issue.predicted_failure_summary}`,
    `Evidence:`,
    evidenceText(evidence)
  ].join('\n');
}

function firstRepositoryRef(...candidates) {
  for (const candidate of candidates) {
    if (typeof candidate !== 'string') continue;
    const trimmed = candidate.trim();
    if (trimmed.length > 0) return trimmed;
  }
  return '';
}

function appendConcreteRepositoryContext(summary, issue) {
  const evidencePaths = (issue.evidence ?? [])
    .map((item) => (item && typeof item.ref === 'string' ? item.ref : ''))
    .filter(Boolean);
  const assetPaths = Array.isArray(issue.affected_assets) ? issue.affected_assets : [];
  const primaryPath = firstRepositoryRef(
    ...evidencePaths,
    ...assetPaths,
    typeof issue.source_findings?.[0] === 'string' ? issue.source_findings[0] : ''
  );

  if (!primaryPath) {
    return `${summary} Concrete repository context: ${evidencePaths[0] || assetPaths[0] || 'repo surface'}.`;
  }

  const remainingPaths = [...evidencePaths, ...assetPaths].filter((path) => path && path !== primaryPath);
  const uniquePaths = [...new Set([primaryPath, ...remainingPaths])].map((path) => `\`${path}\``);
  return `${summary} Concrete repository context: ${uniquePaths.join(', ')}.`;
}

function ensureConcreteIssueTitle(issue) {
  const primaryPath =
    firstRepositoryRef(
      ...(issue.evidence ?? []).map((item) => (item && typeof item.ref === 'string' ? item.ref : '')),
      ...(Array.isArray(issue.affected_assets) ? issue.affected_assets : [])
    ) || 'repository-surface';

  if (typeof issue.title === 'string' && (/\/[\w.-]+\.\w+/.test(issue.title) || /`[^`]+`/.test(issue.title))) {
    return issue.title;
  }

  return `${issue.title} (${primaryPath})`;
}

function isDuplicateOnlyIssueCandidate(candidate) {
  const sourceFindings = Array.isArray(candidate?.source_findings) ? candidate.source_findings : [];
  return sourceFindings.some((findingId) => /duplicate/i.test(String(findingId)));
}

export function buildFixtureOutputFromFindings(canonicalFindings = [], promptPath = '') {
  if (!Array.isArray(canonicalFindings) || canonicalFindings.length === 0) {
    return { issues: [] };
  }

  const issues = canonicalFindings.map((finding) => {
    const issue = toIssueFromFinding(finding);
    return {
      ...issue,
      title: ensureConcreteIssueTitle(issue),
      predicted_failure_summary: appendConcreteRepositoryContext(issue.predicted_failure_summary, issue),
      why_it_matters:
        typeof issue.why_it_matters === 'string'
          ? `${issue.why_it_matters} Affected assets: ${(issue.affected_assets ?? []).join(', ')}.`
          : issue.why_it_matters
    };
  });
  return { issues };
}

export function buildFixtureOutputFromIssueCandidates(issueCandidates = [], sourceAgentOverride = 'issue_validator_agent') {
  if (!Array.isArray(issueCandidates) || issueCandidates.length === 0) {
    return { issues: [] };
  }

  if (issueCandidates.length === 1 && isDuplicateOnlyIssueCandidate(issueCandidates[0])) {
    return { issues: [] };
  }

  const issues = issueCandidates.map((candidate) => {
    const issue = toIssueFromCandidate(candidate);
    return {
      ...issue,
      source_agents: [sourceAgentOverride].filter(Boolean),
      title: ensureConcreteIssueTitle(issue),
      predicted_failure_summary: appendConcreteRepositoryContext(issue.predicted_failure_summary, issue),
      why_it_matters:
        typeof issue.why_it_matters === 'string'
          ? `${issue.why_it_matters} Affected assets: ${(issue.affected_assets ?? []).join(', ')}.`
          : issue.why_it_matters
    };
  });
  return { issues };
}

export function buildPromptMessages(promptText, context = {}) {
  const vars = context?.vars ?? {};
  const promptPath = typeof vars.promptPath === 'string' ? vars.promptPath : '';
  const canonicalFindings = Array.isArray(vars.canonicalFindings) ? vars.canonicalFindings : [];
  const issueCandidates = Array.isArray(vars.issueCandidates) ? vars.issueCandidates : [];
  const dedupeClusters = Array.isArray(vars.dedupeClusters) ? vars.dedupeClusters : [];
  const isValidator = /Issue Validator Agent/i.test(promptText) || /issue-validator/i.test(promptPath);
  const payload = isValidator
    ? {
        issue_candidates: issueCandidates,
        validation_policy: vars.validationPolicy ?? 'Reject vague, duplicated, weakly evidenced, or non-testable issues.'
      }
    : {
        canonical_findings: canonicalFindings,
        dedupe_clusters: dedupeClusters
      };

  return {
    isValidator,
    messages: [
      { role: 'system', content: promptText },
      {
        role: 'user',
        content: [
          'Return only valid JSON.',
          'Do not wrap the JSON in markdown fences.',
          isValidator
            ? 'The top-level object must use the key "issues" and preserve only valid issues.'
            : 'The top-level object must use the key "issues".',
          '',
          JSON.stringify(payload, null, 2)
        ].join('\n')
      }
    ]
  };
}

export function buildGroundingContextFromVars(vars = {}) {
  const canonicalFindings = Array.isArray(vars.canonicalFindings) ? vars.canonicalFindings : [];
  const issueCandidates = Array.isArray(vars.issueCandidates) ? vars.issueCandidates : [];
  const source = canonicalFindings[0] ?? issueCandidates[0];
  if (!source) return 'No source context supplied.';

  const issue = canonicalFindings.length > 0 ? toIssueFromFinding(source) : toIssueFromCandidate(source);
  return buildGroundingContext(issue);
}

export function buildSourceAgentName(promptPath, vars = {}) {
  const canonicalFindings = Array.isArray(vars.canonicalFindings) ? vars.canonicalFindings : [];
  const issueCandidates = Array.isArray(vars.issueCandidates) ? vars.issueCandidates : [];
  const source = canonicalFindings[0] ?? issueCandidates[0];
  if (!source) return promptPath.replace(/\.md$/i, '').split('/').pop() || 'premortem_agent';
  return (source.agent || source.source_agents?.[0] || promptPath)
    .toString()
    .replace(/[^a-zA-Z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .toLowerCase();
}

export function makeFindingTestCase({
  description,
  promptPath,
  canonicalFindings,
  dedupeClusters = [],
  expectedCategories,
  expectedAgent,
  expectRefusal = false
}) {
  const groundingContext = buildGroundingContextFromVars({ canonicalFindings, dedupeClusters });
  const assertions = [
    {
      type: 'is-json',
      value: {
        type: 'object',
        required: ['issues'],
        properties: {
          issues: {
            type: 'array'
          }
        }
      }
    },
    expectRefusal
      ? {
          type: 'javascript',
          value: 'JSON.parse(output).issues.length === 0'
        }
      : {
          type: 'javascript',
          value: 'JSON.parse(output).issues.length >= 1'
        },
    expectRefusal
      ? null
      : {
          type: 'javascript',
          value: [
            'const parsed = JSON.parse(output);',
            'return parsed.issues.every((issue) => Array.isArray(issue.evidence) && issue.evidence.length >= 2);'
          ].join('\n')
        },
    expectRefusal
      ? null
      : {
          type: 'javascript',
          value: [
            'const parsed = JSON.parse(output);',
            'const categories = new Set(parsed.issues.map((issue) => issue.category));',
            'const expectedCategories = Array.isArray(context.vars.expectedCategories)',
            '  ? context.vars.expectedCategories',
            '  : [context.vars.expectedCategories].filter(Boolean);',
            'return expectedCategories.every((category) => categories.has(category));'
          ].join('\n')
        },
    expectRefusal
      ? null
      : {
          type: 'javascript',
          value: [
            'const parsed = JSON.parse(output);',
            'const expectedAgent = context.vars.expectedAgent;',
            'return parsed.issues.some((issue) => Array.isArray(issue.source_agents) && issue.source_agents.includes(expectedAgent));'
          ].join('\n')
        },
    expectRefusal
      ? null
      : {
          type: 'javascript',
          value: [
            'const parsed = JSON.parse(output);',
            'const repoContext = String(context.vars.context ?? "");',
            'return parsed.issues.every((issue) => {',
            '  const evidenceRefs = Array.isArray(issue.evidence) ? issue.evidence.map((item) => String(item.ref || "")) : [];',
            '  const hasConcreteContext = typeof issue.predicted_failure_summary === "string" && issue.predicted_failure_summary.includes("Concrete repository context:");',
            '  const groundedEvidence = evidenceRefs.some((ref) => ref.length > 0 && repoContext.includes(ref));',
            '  return hasConcreteContext && groundedEvidence;',
            '});'
          ].join('\n')
        }
  ].filter(Boolean);

  return {
    description,
    vars: {
      promptPath,
      query: description,
      canonicalFindings,
      dedupeClusters,
      context: groundingContext,
      expectedCategories,
      expectedAgent,
      expectRefusal
    },
    assert: assertions
  };
}

export function makeValidatorTestCase({
  description,
  promptPath,
  issueCandidates,
  expectRefusal = false,
  expectedAgent = 'issue_validator_agent'
}) {
  const groundingContext = buildGroundingContextFromVars({ issueCandidates });
  const assertions = [
    {
      type: 'is-json',
      value: {
        type: 'object',
        required: ['issues']
      }
    },
    expectRefusal
      ? {
          type: 'javascript',
          value: 'JSON.parse(output).issues.length === 0'
        }
      : {
          type: 'javascript',
          value: 'JSON.parse(output).issues.length >= 1'
        },
    expectRefusal
      ? null
      : {
          type: 'javascript',
          value: [
            'const parsed = JSON.parse(output);',
            'const expectedAgent = context.vars.expectedAgent;',
            'return parsed.issues.every((issue) => Array.isArray(issue.source_agents) && issue.source_agents.includes(expectedAgent));'
          ].join('\n')
        },
    expectRefusal
      ? null
      : {
          type: 'javascript',
          value: [
            'const parsed = JSON.parse(output);',
            'const repoContext = String(context.vars.context ?? "");',
            'return parsed.issues.every((issue) => {',
            '  const evidenceRefs = Array.isArray(issue.evidence) ? issue.evidence.map((item) => String(item.ref || "")) : [];',
            '  const hasConcreteContext = typeof issue.predicted_failure_summary === "string" && issue.predicted_failure_summary.includes("Concrete repository context:");',
            '  const groundedEvidence = evidenceRefs.some((ref) => ref.length > 0 && repoContext.includes(ref));',
            '  return hasConcreteContext && groundedEvidence;',
            '});'
          ].join('\n')
        }
  ].filter(Boolean);

  return {
    description,
    vars: {
      promptPath,
      query: description,
      issueCandidates,
      context: groundingContext,
      expectRefusal,
      expectedAgent
    },
    assert: assertions
  };
}

export const repoRootPath = repoRoot;
