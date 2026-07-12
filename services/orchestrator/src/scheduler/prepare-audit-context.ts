import { prisma, resolveGitLabCredentialsForProject, getOrganizationLlmSettings } from '@premortem/db';
import { allowsForceLocalIngest, allowsLocalIngestBypass, isProductionMode } from '@premortem/domain';
import type { RegisteredAgent } from '@premortem/agent-kit';
import type { AuditJob } from '@premortem/workflow';
import {
  fetchOrbitContext,
  fetchGitLabMergeRequestChanges,
  summarizeGitLabMergeRequestDiff,
  type GitLabMergeRequestDiffSummary,
  type OrbitContext
} from '@premortem/integrations';

import { ingestGitLabProject } from '../ingestion/ingest-gitlab';
import {
  buildSourceSnapshot,
  buildSandboxIngestionBundle,
  ingestProject,
  summarizeTextPreview,
  sampleText,
  type IngestionBundle
} from '../ingestion/ingest-project';
import { buildRegisteredAgents } from '../registry/build-registered-agents';
import type { LlmExecutorConfig } from '../executors/llm-executors';

export interface PreparedAuditContext {
  ingestion: IngestionBundle;
  rootDir: string;
  agents: RegisteredAgent[];
  llmConfig: LlmExecutorConfig;
  ingestionSource: 'local' | 'gitlab';
  orbitContext: OrbitContext | null;
  projectSettings: {
    enabledAgents: string[];
  };
}

function augmentIngestionWithSnippet(ingestion: IngestionBundle, codeSnippet: string): IngestionBundle {
  const trimmed = codeSnippet.trim();
  if (!trimmed) {
    return ingestion;
  }

  const sourcePath = 'adhoc-snippet.ts';
  const snippetSource = buildSourceSnapshot(sourcePath, trimmed, 'source');
  const source_files = ingestion.source_files.some((source) => source.path === sourcePath)
    ? ingestion.source_files.map((source) => (source.path === sourcePath ? snippetSource : source))
    : [snippetSource, ...ingestion.source_files];
  const source_code_samples = {
    ...ingestion.source_code_samples,
    [sourcePath]: sampleText(trimmed)
  };

  return {
    ...ingestion,
    source_files,
    source_code_samples,
    metadata: {
      ...ingestion.metadata,
      snippetSourcePath: sourcePath,
      snippetSourceCount: Object.keys(source_code_samples).length
    }
  };
}

function augmentIngestionWithMergeRequest(
  ingestion: IngestionBundle,
  mergeRequest: NonNullable<AuditJob['mergeRequest']>,
  diff: {
    changedFileCount: number;
    diffSnippet: string;
    changes: GitLabMergeRequestDiffSummary['changes'];
  }
): IngestionBundle {
  const sourcePath = `merge-request-${mergeRequest.iid}.diff`;
  const sourcePreview = diff.diffSnippet.trim().length > 0 ? diff.diffSnippet.trim() : `Merge request ${mergeRequest.iid}`;
  return {
    ...ingestion,
    source_files: ingestion.source_files.some((source) => source.path === sourcePath)
      ? ingestion.source_files
      : [
          ...ingestion.source_files,
          {
            path: sourcePath,
            kind: 'doc',
            lineCount: sourcePreview.split('\n').length,
            preview: sourcePreview
          }
        ],
    source_code_samples: {
      ...ingestion.source_code_samples,
      [sourcePath]: summarizeTextPreview(sourcePreview, 40).preview
    },
    merge_request: {
      iid: mergeRequest.iid,
      title: mergeRequest.title,
      sourceBranch: mergeRequest.sourceBranch,
      targetBranch: mergeRequest.targetBranch,
      sha: mergeRequest.sha,
      webUrl: mergeRequest.webUrl,
      action: mergeRequest.action,
      changedFileCount: diff.changedFileCount,
      diffSnippet: sourcePreview,
      changes: diff.changes
    },
    metadata: {
      ...ingestion.metadata,
      mergeRequestIid: mergeRequest.iid,
      mergeRequestAction: mergeRequest.action ?? null,
      mergeRequestChangedFileCount: diff.changedFileCount
    }
  } as IngestionBundle;
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
    maxTokens: llmSettings.maxTokens,
    vendorRouting: llmSettings.vendorRouting,
    customProviders: llmSettings.customProviders
  };

  const project = await prisma.project.findUnique({ where: { id: job.projectId } });
  const projectSetting = await prisma.projectSetting.findUnique({
    where: { projectId: job.projectId },
    select: { enabledAgents: true }
  });
  const enabledAgents = Array.isArray(projectSetting?.enabledAgents)
    ? projectSetting.enabledAgents.filter((agent): agent is string => typeof agent === 'string' && agent.length > 0)
    : [];
  const mergeRequest = job.mergeRequest;
  if (job.codeSnippet?.trim()) {
    let ingestion: IngestionBundle;

    if (project?.provider === 'gitlab' && project.externalProjectId) {
      const credentials = await resolveGitLabCredentialsForProject(job.projectId);
      if (credentials) {
        ingestion = augmentIngestionWithSnippet(
          await ingestGitLabProject({
            baseUrl: credentials.baseUrl,
            token: credentials.token,
            externalProjectId: project.externalProjectId,
            branch: project.defaultBranch || job.branch,
            commitSha: job.commitSha,
            projectId: job.projectId
          }),
          job.codeSnippet
        );
      } else if (allowsLocalIngestBypass()) {
        ingestion = augmentIngestionWithSnippet(
          await ingestProject({
            rootDir: fallbackRoot,
            branch: project.defaultBranch || job.branch,
            commitSha: job.commitSha,
            projectId: job.projectId
          }),
          job.codeSnippet
        );
      } else {
        throw new Error(
          'GitLab credentials are required for this project. Connect GitLab in Settings before running a snippet audit.'
        );
      }
    } else {
      ingestion = augmentIngestionWithSnippet(
        buildSandboxIngestionBundle({
          branch: job.branch,
          commitSha: job.commitSha,
          codeSnippet: job.codeSnippet
        }),
        job.codeSnippet
      );
    }

    return {
      ingestion,
      rootDir: fallbackRoot,
      agents: buildRegisteredAgents(fallbackRoot, llmConfig),
      llmConfig,
      ingestionSource: 'local',
      orbitContext: null,
      projectSettings: {
        enabledAgents
      }
    };
  }

  const mergeRequestDiff =
    mergeRequest && project?.provider === 'gitlab' && project.externalProjectId
      ? await (async () => {
          const credentials = await resolveGitLabCredentialsForProject(job.projectId);
          if (!credentials) return null;
          const details = await fetchGitLabMergeRequestChanges({
            baseUrl: credentials.baseUrl,
            token: credentials.token,
            externalProjectId: project.externalProjectId,
            iid: mergeRequest.iid
          });
          return details;
        })()
      : null;

  const forceLocal = allowsForceLocalIngest();
  const orbitContextPromise =
    project?.provider === 'gitlab' && project.externalProjectId
      ? fetchOrbitContext({
          externalProjectId: project.externalProjectId,
          branch: job.branch
        })
      : Promise.resolve(null);

  if (!forceLocal && project?.provider === 'gitlab' && project.externalProjectId) {
    const credentials = await resolveGitLabCredentialsForProject(job.projectId);
    if (credentials) {
      let ingestion = await ingestGitLabProject({
        baseUrl: credentials.baseUrl,
        token: credentials.token,
        externalProjectId: project.externalProjectId,
        branch: job.branch,
        commitSha: job.commitSha,
        projectId: job.projectId
      });

      if (mergeRequestDiff && mergeRequest) {
        ingestion = augmentIngestionWithMergeRequest(ingestion, mergeRequest, {
          changedFileCount: mergeRequestDiff.changedFileCount,
          diffSnippet:
            mergeRequestDiff.diffSnippet.trim().length > 0
              ? mergeRequestDiff.diffSnippet
              : summarizeGitLabMergeRequestDiff(mergeRequestDiff.changes),
          changes: mergeRequestDiff.changes
        });
      }

      return {
        ingestion,
        rootDir: fallbackRoot,
        agents: buildRegisteredAgents(fallbackRoot, llmConfig),
        llmConfig,
        ingestionSource: 'gitlab',
        orbitContext: await orbitContextPromise,
        projectSettings: {
          enabledAgents
        }
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
    commitSha: job.commitSha,
    projectId: job.projectId
  });

  const finalIngestion =
    mergeRequest && mergeRequestDiff
      ? augmentIngestionWithMergeRequest(ingestion, mergeRequest, {
          changedFileCount: mergeRequestDiff.changedFileCount,
          diffSnippet:
            mergeRequestDiff.diffSnippet.trim().length > 0
              ? mergeRequestDiff.diffSnippet
              : summarizeGitLabMergeRequestDiff(mergeRequestDiff.changes),
          changes: mergeRequestDiff.changes
        })
      : ingestion;

  return {
    ingestion: finalIngestion,
    rootDir: fallbackRoot,
    agents: buildRegisteredAgents(fallbackRoot, llmConfig),
    llmConfig,
    ingestionSource: 'local',
    orbitContext: await orbitContextPromise,
    projectSettings: {
      enabledAgents
    }
  };
}
