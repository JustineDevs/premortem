import { fetchWithTimeout } from './fetch-with-timeout';
import { gitLabAuthHeaders } from './gitlab-auth';

export interface GitLabQualityGateSyncResult {
  settingsUpdated: boolean;
  ruleApplied: boolean;
  ruleId?: number;
  ruleName: string;
}

function jsonHeaders(token: string) {
  return {
    ...gitLabAuthHeaders(token),
    'content-type': 'application/json'
  };
}

async function readJson<T>(response: Response, label: string): Promise<T> {
  if (!response.ok) {
    throw new Error(`${label} failed: ${response.status} ${await response.text()}`);
  }
  return response.json() as Promise<T>;
}

export async function syncGitLabQualityGate(input: {
  baseUrl: string;
  token: string;
  externalProjectId: string;
  ruleName?: string;
}): Promise<GitLabQualityGateSyncResult> {
  const ruleName = input.ruleName?.trim() || 'Premortem quality gate';
  const encodedProject = encodeURIComponent(input.externalProjectId);

  const settingsResponse = await fetchWithTimeout(
    `${input.baseUrl.replace(/\/$/, '')}/api/v4/projects/${encodedProject}/approvals`,
    {
      method: 'POST',
      headers: jsonHeaders(input.token),
      body: JSON.stringify({
        approvals_before_merge: 1,
        merge_requests_author_approval: false,
        merge_requests_disable_committers_approval: true,
        reset_approvals_on_push: true,
        disable_overriding_approvers_per_merge_request: true
      })
    }
  );
  await readJson<unknown>(settingsResponse, 'GitLab approval settings sync');

  const existingRulesResponse = await fetchWithTimeout(
    `${input.baseUrl.replace(/\/$/, '')}/api/v4/projects/${encodedProject}/approval_rules?per_page=100`,
    { headers: gitLabAuthHeaders(input.token) }
  );
  const existingRules = await readJson<Array<{ id: number; name: string }>>(
    existingRulesResponse,
    'GitLab approval rule list'
  );

  const existing = existingRules.find((rule) => rule.name === ruleName);
  if (existing) {
    const updateResponse = await fetchWithTimeout(
      `${input.baseUrl.replace(/\/$/, '')}/api/v4/projects/${encodedProject}/approval_rules/${existing.id}`,
      {
        method: 'PUT',
        headers: jsonHeaders(input.token),
        body: JSON.stringify({
          name: ruleName,
          approvals_required: 1,
          rule_type: 'any_approver',
          applies_to_all_protected_branches: true
        })
      }
    );
    await readJson<unknown>(updateResponse, 'GitLab approval rule update');
    return {
      settingsUpdated: true,
      ruleApplied: true,
      ruleId: existing.id,
      ruleName
    };
  }

  const createResponse = await fetchWithTimeout(
    `${input.baseUrl.replace(/\/$/, '')}/api/v4/projects/${encodedProject}/approval_rules`,
    {
      method: 'POST',
      headers: jsonHeaders(input.token),
      body: JSON.stringify({
        name: ruleName,
        approvals_required: 1,
        rule_type: 'any_approver',
        applies_to_all_protected_branches: true
      })
    }
  );
  const created = await readJson<{ id: number }>(createResponse, 'GitLab approval rule create');

  return {
    settingsUpdated: true,
    ruleApplied: true,
    ruleId: created.id,
    ruleName
  };
}
