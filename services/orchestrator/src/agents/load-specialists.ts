import { loadRegistry } from '@premortem/agent-kit';

export function loadSpecialists(rootDir: string) {
  const registry = loadRegistry(rootDir);
  return registry.agents.filter((agent) => agent.name.endsWith('_agent'));
}
