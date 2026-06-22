import type { CanonicalFinding, IssueCandidate } from './types';

function hash(input: string) {
  let value = 0;
  for (let i = 0; i < input.length; i += 1) value = (value * 31 + input.charCodeAt(i)) >>> 0;
  return value;
}

function repoTreeFromPayload(payload: Record<string, unknown>): string[] {
  if (!Array.isArray(payload.repo_tree)) return [];
  return payload.repo_tree.filter((entry): entry is string => typeof entry === 'string');
}

function pickRepoPaths(payload: Record<string, unknown>, category: string, count = 2): string[] {
  const tree = repoTreeFromPayload(payload).filter(
    (path) =>
      path.includes('.') &&
      !path.startsWith('.git/') &&
      !path.includes('node_modules/') &&
      !path.endsWith('.lock')
  );
  if (tree.length === 0) return [];

  const keywords = category.split('_').filter(Boolean);
  const matched = tree.filter((path) => {
    const lower = path.toLowerCase();
    return keywords.some((keyword) => lower.includes(keyword));
  });

  const pool = matched.length >= count ? matched : tree;
  const seed = hash(`${category}:${String(payload.projectId ?? '')}:${String(payload.branch ?? '')}`);
  const start = seed % Math.max(pool.length - count, 1);
  return pool.slice(start, start + count);
}

export function makeMockFinding(agent: string, category: string, payload: Record<string, unknown>): CanonicalFinding {
  const projectId = String(payload.projectId ?? 'project');
  const branch = String(payload.branch ?? 'main');
  const key = `${agent}:${projectId}:${branch}`;
  const seed = hash(key);
  const repoPaths = pickRepoPaths(payload, category, 2);
  const primaryPath = repoPaths[0] ?? `${category}/boundary.ts`;
  const secondaryPath = repoPaths[1] ?? `${category}/config.yml`;

  return {
    agent,
    finding_id: key,
    category,
    finding_type: `${category}_risk`,
    severity: seed % 5 === 0 ? 'high' : 'medium',
    confidence: 0.72,
    predicted_failure: {
      summary: `Changes to \`${primaryPath}\` on \`${branch}\` can break ${category.replaceAll('_', ' ')} controls during routine delivery.`,
      failure_mode: `Unowned ${category.replaceAll('_', ' ')} boundary fails under normal deployment churn.`,
      trigger_conditions: [
        `A merge updates \`${primaryPath}\` without boundary validation.`,
        `Branch \`${branch}\` is promoted without verifying dependent paths in \`${secondaryPath}\`.`
      ],
      blast_radius: seed % 5 === 0 ? 'pipeline' : 'component'
    },
    why_it_matters: `The ${category.replaceAll('_', ' ')} surface around \`${primaryPath}\` can fail after merge while appearing healthy during review.`,
    affected_assets: [primaryPath, secondaryPath, `${projectId}:${branch}`],
    evidence: [
      {
        kind: 'file',
        ref: primaryPath,
        reason: `Primary ${category.replaceAll('_', ' ')} hotspot appears central to the change path.`
      },
      {
        kind: 'config',
        ref: secondaryPath,
        reason: `Supporting config path lacks a strong verification control.`
      }
    ],
    recommended_controls: [
      `Add explicit ${category.replaceAll('_', ' ')} boundary checks in CI for \`${primaryPath}\`.`,
      `Assign ownership and test gates to \`${secondaryPath}\`.`
    ],
    dedupe_keys: [category, primaryPath, branch],
    tags: [agent, category, 'mock-runtime']
  };
}

export function synthesizeMockIssues(findings: CanonicalFinding[]): IssueCandidate[] {
  const grouped = new Map<string, CanonicalFinding[]>();
  for (const finding of findings) {
    const key = finding.category;
    grouped.set(key, [...(grouped.get(key) ?? []), finding]);
  }

  return [...grouped.entries()].map(([category, items]) => {
    const primaryAsset = items[0]?.affected_assets[0] ?? category;
    const agents = [...new Set(items.map((item) => item.agent).filter((agent): agent is string => typeof agent === 'string' && agent.length > 0))];
    const categoryLabel = category.replaceAll('_', ' ');
    const predictedFailures = items.flatMap((item) => {
      const summary = item.predicted_failure?.summary;
      const triggerConditions = item.predicted_failure?.trigger_conditions ?? [];
      return summary ? [{ summary, triggerConditions }] : [];
    });
    const evidence = items.flatMap((item) => item.evidence ?? []);
    const sourceFindings = items
      .map((item) => item.finding_id)
      .filter((findingId): findingId is string => typeof findingId === 'string' && findingId.length > 0);

    return {
      title: `Harden ${categoryLabel} around \`${primaryAsset}\` before the next production rollout`,
      category,
      severity: items.some((item) => item.severity === 'high') ? 'high' : 'medium',
      confidence: 0.78,
      predicted_failure_summary:
        predictedFailures[0]?.summary ??
        `Changes to \`${primaryAsset}\` can break ${categoryLabel} during routine delivery.`,
      why_it_matters: `Multiple specialist signals converge on \`${primaryAsset}\` as the remediation surface for ${categoryLabel}.`,
      trigger_conditions: predictedFailures.flatMap((item) => item.triggerConditions).slice(0, 4),
      evidence: evidence.slice(0, 4),
      recommended_action_summary: `Add durable controls around \`${primaryAsset}\` and related ${categoryLabel} paths before the next production change.`,
      implementation_steps: [
        `Add a CI validation gate covering \`${primaryAsset}\`.`,
        `Document ownership and regression checks for ${categoryLabel} boundaries.`,
        `Verify blast radius on branch promotion before publish.`
      ],
      done_criteria: [
        `${categoryLabel} changes fail safely in CI when the contract breaks.`,
        `Owners can verify blast radius for \`${primaryAsset}\` before publish.`,
        `Regression coverage exists for the listed trigger conditions.`
      ],
      affected_assets: [...new Set(items.flatMap((item) => item.affected_assets))],
      source_agents: agents,
      source_findings: sourceFindings
    };
  });
}
