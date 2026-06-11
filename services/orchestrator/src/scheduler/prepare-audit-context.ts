import { prisma, resolveGitLabCredentialsForProject, getOrganizationLlmSettings } from '@premortem/db';
import { allowsForceLocalIngest, allowsLocalIngestBypass, isProductionMode } from '@premortem/domain';
import type { RegisteredAgent } from '@premortem/agent-kit';
import type { AuditJob } from '@premortem/workflow';

import { ingestGitLabProject } from '../ingestion/ingest-gitlab';
import { ingestProject, type IngestionBundle } from '../ingestion/ingest-project';
import { buildRegisteredAgents } from '../registry/build-registered-agents';
import type { LlmExecutorConfig } from '../executors/llm-executors';

export interface PreparedAuditContext {
  ingestion: IngestionBundle;
  rootDir: string;
  agents: RegisteredAgent[];
  llmConfig: LlmExecutorConfig;
  ingestionSource: 'local' | 'gitlab';
}

export async function prepareAuditExecution(
  job: AuditJob,
  options?: { rootDir?: string }
): Promise<PreparedAuditContext> {
  const fallbackRoot = options?.rootDir ?? process.env.PREMORTEM_ROOT_DIR ?? process.cwd();
  const llmSettings = await getOrganizationLlmSettings(job.organizationId);
  const llmConfig: LlmExecutorConfig = {
    model: llmSettings.selectedGeminiModel,
    temperature: llmSettings.temperature,
    maxTokens: llmSettings.maxTokens
  };

  const project = await prisma.project.findUnique({ where: { id: job.projectId } });
  const forceLocal = allowsForceLocalIngest();

  if (!forceLocal && project?.provider === 'gitlab' && project.externalProjectId) {
    const credentials = await resolveGitLabCredentialsForProject(job.projectId);
    if (credentials) {
      const ingestion = await ingestGitLabProject({
        baseUrl: credentials.baseUrl,
        token: credentials.token,
        externalProjectId: project.externalProjectId,
        branch: job.branch,
        commitSha: job.commitSha
      });

      return {
        ingestion,
        rootDir: fallbackRoot,
        agents: buildRegisteredAgents(fallbackRoot, llmConfig),
        llmConfig,
        ingestionSource: 'gitlab'
      };
    }

    if (!allowsLocalIngestBypass()) {
      throw new Error(
        'GitLab credentials are required for this project. Connect GitLab in Settings before running an audit.'
      );
    }
  }

  if (isProductionMode()) {
    throw new Error(
      'Production mode requires GitLab ingestion from a connected repository. Connect GitLab in Settings and register a project before running an audit.'
    );
  }

  const ingestion = await ingestProject({
    rootDir: fallbackRoot,
    branch: job.branch,
    commitSha: job.commitSha
  });

  return {
    ingestion,
    rootDir: fallbackRoot,
    agents: buildRegisteredAgents(fallbackRoot, llmConfig),
    llmConfig,
    ingestionSource: 'local'
  };
}
