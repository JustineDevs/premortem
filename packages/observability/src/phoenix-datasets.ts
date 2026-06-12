import {
  appendDatasetExamples,
  createDataset,
  getDatasetInfo
} from '@arizeai/phoenix-client/datasets';

import { createPremortemPhoenixClient, isPhoenixClientConfigured } from './phoenix-client-config';

export const PREMORTEM_PHOENIX_AUDIT_DATASET_NAME = 'premortem-audit-missions';

export interface AuditMissionDatasetExampleInput {
  auditRunId: string;
  organizationId: string;
  projectId?: string | null;
  repositoryId?: string | null;
}

export interface AuditMissionDatasetExampleOutput {
  findingCount: number;
  issueCandidateCount: number;
  rejectedIssueCount?: number;
  hasHumanReviewGate: boolean;
  passed: boolean;
  score: number;
}

export interface AppendAuditMissionDatasetExampleInput {
  input: AuditMissionDatasetExampleInput;
  output: AuditMissionDatasetExampleOutput;
  metadata?: Record<string, unknown>;
}

export function isPhoenixDatasetSyncEnabled() {
  return process.env.PHOENIX_SYNC_DATASETS === '1' && isPhoenixClientConfigured();
}

export async function ensurePremortemAuditDataset() {
  const client = createPremortemPhoenixClient();

  return createDataset({
    client,
    name: PREMORTEM_PHOENIX_AUDIT_DATASET_NAME,
    description:
      'Completed Premortem audit missions for Phoenix experiments and code evaluators.',
    examples: [
      {
        input: {
          auditRunId: 'seed-example',
          organizationId: 'seed-org',
          projectId: null,
          repositoryId: null
        },
        output: {
          findingCount: 3,
          issueCandidateCount: 2,
          rejectedIssueCount: 0,
          hasHumanReviewGate: true,
          passed: true,
          score: 0.83
        },
        metadata: {
          source: 'premortem-bootstrap',
          note: 'Replace with live audit runs when PHOENIX_SYNC_DATASETS=1'
        }
      }
    ]
  });
}

export async function appendAuditMissionToPhoenixDataset(
  example: AppendAuditMissionDatasetExampleInput
) {
  const client = createPremortemPhoenixClient();

  return appendDatasetExamples({
    client,
    dataset: { datasetName: PREMORTEM_PHOENIX_AUDIT_DATASET_NAME },
    examples: [
      {
        id: example.input.auditRunId,
        input: { ...example.input },
        output: { ...example.output },
        metadata: {
          syncedAt: new Date().toISOString(),
          ...example.metadata
        }
      }
    ]
  });
}

export async function getPremortemAuditDatasetInfo() {
  const client = createPremortemPhoenixClient();

  return getDatasetInfo({
    client,
    dataset: { datasetName: PREMORTEM_PHOENIX_AUDIT_DATASET_NAME }
  });
}
