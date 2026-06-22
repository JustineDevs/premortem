import { createRegisteredAgents } from '@premortem/agent-kit';
import { hasConfiguredRuntimeCredentials } from '@premortem/domain';
import { createDefaultExecutors } from '../executors/default-executors';
import { buildWorkerRegisteredAgents } from './build-worker-registered-agents';
import type { LlmExecutorConfig } from '../executors/llm-executors';

function resolveExecutorMode() {
  if (process.env.PREMORTEM_EXECUTOR) {
    return process.env.PREMORTEM_EXECUTOR;
  }
  if (hasConfiguredRuntimeCredentials()) {
    return 'llm';
  }
  return 'mock';
}

export function buildRegisteredAgents(rootDir: string, llmConfig?: LlmExecutorConfig) {
  const mode = resolveExecutorMode();
  if (mode === 'llm') {
    return buildWorkerRegisteredAgents(rootDir, llmConfig);
  }
  return createRegisteredAgents({
    rootDir,
    executors: createDefaultExecutors()
  });
}
