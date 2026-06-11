import { createRegisteredAgents } from '@premortem/agent-kit';
import { createDefaultExecutors } from '../executors/default-executors';
import { buildWorkerRegisteredAgents } from './build-worker-registered-agents';
import type { LlmExecutorConfig } from '../executors/llm-executors';

function resolveExecutorMode() {
  if (process.env.PREMORTEM_EXECUTOR) {
    return process.env.PREMORTEM_EXECUTOR;
  }
  if (process.env.GEMINI_API_KEY || process.env.AZURE_OPENAI_API_KEY) {
    return 'llm';
  }
  return 'mock';
}

export function buildRegisteredAgents(rootDir: string, llmConfig?: LlmExecutorConfig) {
  const mode = resolveExecutorMode();
  if (mode === 'llm') {
    return buildWorkerRegisteredAgents(llmConfig);
  }
  return createRegisteredAgents({
    rootDir,
    executors: createDefaultExecutors()
  });
}
