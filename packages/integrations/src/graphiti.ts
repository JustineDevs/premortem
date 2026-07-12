import type { CanonicalFinding } from '@premortem/agent-kit';
import { captureServerException } from '@premortem/observability';
import { searchEpisodes, writeEpisode } from '@premortem/graphiti';

export function isGraphitiEnabled(): boolean {
  return true;
}

export async function writeAuditEpisode(input: {
  projectId: string;
  auditRunId: string;
  findings: CanonicalFinding[];
  completedAt: string;
}): Promise<void> {
  if (!isGraphitiEnabled()) return;

  try {
    await writeEpisode({
      name: `audit:${input.projectId}:${input.auditRunId}`,
      body: JSON.stringify(
        input.findings.map((finding) => ({
          category: finding.category,
          summary: finding.predicted_failure.summary,
          severity: finding.severity,
          trigger_conditions: finding.predicted_failure.trigger_conditions,
          dedupe_keys: finding.dedupe_keys
        }))
      ),
      source_description: `Premortem audit run ${input.auditRunId} for project ${input.projectId}`,
      reference_time: input.completedAt,
      project_id: input.projectId
    });
  } catch (error) {
    captureServerException(error, {
      context: 'graphiti-episode-write',
      projectId: input.projectId,
      auditRunId: input.auditRunId
    });
  }
}

export async function searchPriorFindings(input: {
  projectId: string;
  query: string;
}): Promise<Array<{ fact: string; valid_at: string | null }>> {
  if (!isGraphitiEnabled()) return [];

  const results = await searchEpisodes({
    query: input.query,
    project_id: input.projectId,
    num_results: 15
  });

  return results
    .filter((result) => typeof result.fact === 'string' && result.fact.trim().length > 0)
    .map((result) => ({
      fact: result.fact,
      valid_at: result.valid_at
    }));
}
