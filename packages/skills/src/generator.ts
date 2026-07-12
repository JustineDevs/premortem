import type { SkillCoverageReport } from './coverage';
import type { SkillRegistryAgent } from './registry';

function slugify(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-{2,}/g, '-');
}

function humanizeCategory(category: string) {
  return category
    .split(/[_\s-]+/g)
    .filter(Boolean)
    .map((part) => `${part.charAt(0).toUpperCase()}${part.slice(1)}`)
    .join(' ');
}

function escapeYaml(value: string) {
  return value.replace(/"/g, '\\"');
}

export interface GeneratedSkillDraft {
  id: string;
  category: string;
  title: string;
  summary: string;
  ownerAgentName: string;
  ownerAgentDescription: string;
  generatedAt: string;
  auditRunId: string;
  installed: boolean;
  markdown: string;
  registryEntry: string;
  storageRef?: string | null;
}

export function buildGeneratedSkillDraft(input: {
  category: string;
  ownerAgent?: SkillRegistryAgent;
  report: SkillCoverageReport;
  generatedAt?: string;
  installed?: boolean;
  storageRef?: string | null;
}): GeneratedSkillDraft {
  const slug = slugify(input.category);
  const title = `${humanizeCategory(input.category)} Skill`;
  const summary = `Covers the ${humanizeCategory(input.category).toLowerCase()} gap detected on audit ${input.report.auditRunId}.`;
  const ownerAgentName = input.ownerAgent?.name ?? 'skill_gap_detector_agent';
  const ownerAgentDescription =
    input.ownerAgent?.description ??
    'Detects missing coverage and turns audit gaps into concrete skill drafts.';
  const generatedAt = input.generatedAt ?? input.report.generatedAt;
  const markdown = [
    '---',
    `name: ${slug}`,
    `description: ${summary}`,
    '---',
    '',
    `# ${title}`,
    '',
    '## Quick start',
    `Use this skill when Premortem reports a coverage gap in ${humanizeCategory(input.category)}.`,
    '',
    '## Purpose',
    `This skill closes the ${humanizeCategory(input.category).toLowerCase()} blind spot uncovered by the skill coverage report.`,
    '',
    '## Workflows',
    '1. Review the latest skill coverage report.',
    '2. Confirm the missing signals and supporting evidence.',
    '3. Register the skill in the registry and save the draft artifact.',
    '',
    '## Expected output',
    'A concrete agent or operator skill that maps the missing coverage to a repeatable workflow.',
    '',
    '## Registry entry',
    '```yaml',
    `- name: ${slug}`,
    `  description: "${escapeYaml(summary)}"`,
    `  prompt: .agents/prompts/generated/${slug}.md`,
    '  run_mode: conditional',
    '  merge_owner_priority: 50',
    '  owns_categories:',
    `    - ${input.category}`,
    '```',
    ''
  ].join('\n');

  const registryEntry = [
    '- name: ' + slug,
    `  description: "${escapeYaml(summary)}"`,
    `  prompt: .agents/prompts/generated/${slug}.md`,
    '  run_mode: conditional',
    '  merge_owner_priority: 50',
    '  owns_categories:',
    `    - ${input.category}`
  ].join('\n');

  return {
    id: `skill:${input.category}`,
    category: input.category,
    title,
    summary,
    ownerAgentName,
    ownerAgentDescription,
    generatedAt,
    auditRunId: input.report.auditRunId,
    installed: input.installed ?? false,
    markdown,
    registryEntry,
    storageRef: input.storageRef ?? null
  };
}
