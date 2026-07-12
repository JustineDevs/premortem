import fs from 'node:fs';
import path from 'node:path';
import yaml from 'yaml';

export interface SkillRegistryAgent {
  name: string;
  description: string;
  prompt: string;
  run_mode: 'always' | 'conditional';
  merge_owner_priority: number;
  analysis_role?: string;
  owns_categories?: string[];
}

export interface SkillRegistry {
  version: number;
  project: string;
  agents: SkillRegistryAgent[];
}

function normalizeAgent(value: unknown): SkillRegistryAgent | null {
  if (!value || typeof value !== 'object') return null;
  const row = value as Record<string, unknown>;
  const name = typeof row.name === 'string' ? row.name : '';
  const description = typeof row.description === 'string' ? row.description : '';
  const prompt = typeof row.prompt === 'string' ? row.prompt : '';
  const runMode = row.run_mode === 'always' || row.run_mode === 'conditional' ? row.run_mode : null;
  const mergeOwnerPriority =
    typeof row.merge_owner_priority === 'number' && Number.isFinite(row.merge_owner_priority)
      ? row.merge_owner_priority
      : 0;

  if (!name || !description || !prompt || !runMode) return null;

  const ownsCategories = Array.isArray(row.owns_categories)
    ? row.owns_categories.filter((entry): entry is string => typeof entry === 'string' && entry.length > 0)
    : [];

  return {
    name,
    description,
    prompt,
    run_mode: runMode,
    merge_owner_priority: mergeOwnerPriority,
    analysis_role: typeof row.analysis_role === 'string' ? row.analysis_role : undefined,
    owns_categories: ownsCategories.length > 0 ? ownsCategories : undefined
  };
}

export function resolvePremortemRoot(rootDir = process.env.PREMORTEM_ROOT_DIR ?? process.cwd()) {
  return path.resolve(rootDir);
}

export function loadSkillRegistry(rootDir = resolvePremortemRoot()): SkillRegistry {
  const file = path.join(rootDir, '.agents', 'registry.yaml');
  const raw = fs.readFileSync(file, 'utf8');
  const parsed = yaml.parse(raw) as Record<string, unknown> | null;
  const agents = Array.isArray(parsed?.agents) ? parsed.agents.map(normalizeAgent).filter((agent): agent is SkillRegistryAgent => Boolean(agent)) : [];
  return {
    version: typeof parsed?.version === 'number' ? parsed.version : 1,
    project: typeof parsed?.project === 'string' ? parsed.project : 'premortem',
    agents
  };
}

export function listRegistrySkillCategories(registry: SkillRegistry): string[] {
  return Array.from(
    new Set(
      registry.agents.flatMap((agent) => agent.owns_categories ?? [])
    )
  ).sort((left, right) => left.localeCompare(right));
}
