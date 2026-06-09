import type { CanonicalFinding, IssueCandidate } from './types';

function hash(input: string) {
  let value = 0;
  for (let i = 0; i < input.length; i += 1) value = (value * 31 + input.charCodeAt(i)) >>> 0;
  return value;
}

export function makeMockFinding(agent: string, category: string, payload: Record<string, unknown>): CanonicalFinding {
  const projectId = String(payload.projectId ?? 'project');
  const branch = String(payload.branch ?? 'main');
  const key = `${agent}:${projectId}:${branch}`;
  const seed = hash(key);
  const riskRef = `repo://${projectId}/${category}/${seed % 7}`;

  return {
    agent,
    finding_id: key,
    category,
    finding_type: `${category}_risk`,
    severity: seed % 5 === 0 ? 'high' : 'medium',
    confidence: 0.72,
    predicted_failure: {
      summary: `${category} drift can break ${projectId} on ${branch} during routine delivery.`,
      failure_mode: `Unowned ${category} boundary fails under normal deployment churn.`,
      trigger_conditions: [
        `A change lands in ${category} without boundary validation.`,
        `The branch ${branch} is promoted without verifying dependent paths.`
      ],
      blast_radius: seed % 5 === 0 ? 'pipeline' : 'component'
    },
    why_it_matters: `The ${category} surface can fail after merge while appearing healthy during review.`,
    affected_assets: [`${projectId}:${category}`, `${projectId}:${branch}`],
    evidence: [
      { kind: 'file', ref: `${riskRef}/primary`, reason: `Primary ${category} hotspot appears central to the change path.` },
      { kind: 'config', ref: `${riskRef}/secondary`, reason: `Supporting config path lacks a strong verification control.` }
    ],
    recommended_controls: [
      `Add explicit ${category} boundary checks in CI.`,
      `Assign ownership and test gates to the affected ${category} surface.`
    ],
    dedupe_keys: [category, projectId, branch],
    tags: [agent, category, 'mock-runtime']
  };
}

export function synthesizeMockIssues(findings: CanonicalFinding[]): IssueCandidate[] {
  const grouped = new Map<string, CanonicalFinding[]>();
  for (const finding of findings) {
    const key = finding.category;
    grouped.set(key, [...(grouped.get(key) ?? []), finding]);
  }

  return [...grouped.entries()].map(([category, items]) => ({
    title: `Contain ${category.replaceAll('_', ' ')} failures before production rollout`,
    category,
    severity: items.some((item) => item.severity === 'high') ? 'high' : 'medium',
    confidence: 0.78,
    predicted_failure_summary: items[0]?.predicted_failure.summary ?? `${category} can fail unexpectedly.`,
    why_it_matters: `Multiple signals point to one remediation surface in ${category}.`,
    trigger_conditions: items.flatMap((item) => item.predicted_failure.trigger_conditions).slice(0, 3),
    evidence: items.flatMap((item) => item.evidence).slice(0, 3),
    recommended_action_summary: `Add durable controls around ${category} before the next production change.`,
    implementation_steps: [
      `Create a validation gate for ${category}.`,
      `Add ownership and regression checks for ${category}.`
    ],
    done_criteria: [
      `${category} changes fail safely in CI when the contract breaks.`,
      `Owners can verify the blast radius before publish.`
    ],
    affected_assets: [...new Set(items.flatMap((item) => item.affected_assets))],
    source_agents: [...new Set(items.map((item) => item.agent))],
    source_findings: items.map((item) => item.finding_id)
  }));
}
