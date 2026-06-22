import { createPrompt, getPrompt, promptVersion } from '@arizeai/phoenix-client/prompts';
import { createPremortemPhoenixClient, isPhoenixClientConfigured } from './phoenix-client-config';

const DEFAULT_GEMINI_MODEL = 'gemini-3-flash-preview';

export const PREMORTEM_PHOENIX_AUDIT_JUDGE_PROMPT_NAME = 'premortem-audit-llm-judge';

const AUDIT_JUDGE_TEMPLATE = [
  'You are an evaluation judge for Premortem predictive code audits.',
  'Score whether the audit mission output is acceptable for human review.',
  'Return JSON only: {"label":"acceptable"|"needs_improvement","explanation":"..."}',
  'Audit run: {{auditRunId}}',
  'Finding count: {{findingCount}}',
  'Issue candidate count: {{issueCandidateCount}}',
  'Sample findings: {{sampleFindingTitles}}'
].join('\n');

export function isPhoenixPromptSyncEnabled() {
  return process.env.PHOENIX_SYNC_PROMPTS === '1' && isPhoenixClientConfigured();
}

export async function ensurePremortemAuditJudgePrompt(modelName = DEFAULT_GEMINI_MODEL) {
  const client = createPremortemPhoenixClient();

  return createPrompt({
    client,
    name: PREMORTEM_PHOENIX_AUDIT_JUDGE_PROMPT_NAME,
    description: 'LLM-as-judge prompt for Premortem completed audit missions.',
    metadata: {
      product: 'premortem',
      surface: 'audit-mission-eval'
    },
    version: promptVersion({
      modelProvider: 'GOOGLE',
      modelName,
      template: [{ role: 'user', content: AUDIT_JUDGE_TEMPLATE }],
      invocationParameters: {
        temperature: 0
      }
    })
  });
}

export async function getPremortemProductionAuditJudgePrompt() {
  const client = createPremortemPhoenixClient();

  return getPrompt({
    client,
    prompt: { name: PREMORTEM_PHOENIX_AUDIT_JUDGE_PROMPT_NAME, tag: 'production' }
  });
}

export async function getPremortemAuditJudgePromptByName() {
  const client = createPremortemPhoenixClient();

  return getPrompt({
    client,
    prompt: { name: PREMORTEM_PHOENIX_AUDIT_JUDGE_PROMPT_NAME }
  });
}
