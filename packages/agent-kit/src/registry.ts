import fs from 'node:fs';
import path from 'node:path';
import yaml from 'yaml';
import type { AgentAnalysisRole } from './types';

export interface AgentRegistry {
  version: number;
  project: string;
  agents: Array<{
    name: string;
    description: string;
    prompt: string;
    run_mode: 'always' | 'conditional';
    merge_owner_priority: number;
    analysis_role?: AgentAnalysisRole;
  }>;
}

export function loadRegistry(rootDir: string): AgentRegistry {
  const file = path.join(rootDir, '.agents', 'registry.yaml');
  const raw = fs.readFileSync(file, 'utf8');
  return yaml.parse(raw) as AgentRegistry;
}
