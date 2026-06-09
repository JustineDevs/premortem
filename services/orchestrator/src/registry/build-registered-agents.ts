import { createRegisteredAgents } from '@premortem/agent-kit';
import { createDefaultExecutors } from '../executors/default-executors';

export function buildRegisteredAgents(rootDir: string) {
  return createRegisteredAgents({
    rootDir,
    executors: createDefaultExecutors()
  });
}
