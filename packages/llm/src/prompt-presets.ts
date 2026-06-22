import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { LlmMessage } from './types';

export type PromptPresetId = 'finding-synthesizer';

export interface FindingSynthesizerPromptInput {
  canonicalFindings: unknown;
  dedupeClusters: unknown;
}

export interface PromptPresetDefinition {
  id: PromptPresetId;
  name: string;
  sourcePromptPath: string;
  outputEnvelopeKey: string;
}

const PRESET_DEFINITIONS: Record<PromptPresetId, PromptPresetDefinition> = {
  'finding-synthesizer': {
    id: 'finding-synthesizer',
    name: 'Premortem Finding Synthesizer',
    sourcePromptPath: '.agents/prompts/finding-synthesizer.md',
    outputEnvelopeKey: 'issues'
  }
};

function resolveRepoRoot() {
  const currentDir = path.dirname(fileURLToPath(import.meta.url));
  return path.resolve(currentDir, '../../..');
}

export function getPromptPresetDefinition(id: PromptPresetId): PromptPresetDefinition {
  return PRESET_DEFINITIONS[id];
}

export function loadPromptPresetSource(id: PromptPresetId): string {
  const definition = getPromptPresetDefinition(id);
  const rootDir = resolveRepoRoot();
  const prompt = fs.readFileSync(path.join(rootDir, definition.sourcePromptPath), 'utf8').trim();
  const floorPath = path.join(rootDir, '.agents/prompts/specialist-floor.md');
  if (!fs.existsSync(floorPath)) {
    return prompt;
  }

  const floor = fs.readFileSync(floorPath, 'utf8').trim();
  return `${floor}\n\n${prompt}`.trim();
}

export function buildFindingSynthesizerMessages(input: FindingSynthesizerPromptInput): LlmMessage[] {
  const systemPrompt = loadPromptPresetSource('finding-synthesizer');
  const userPrompt = [
    'Return only valid JSON.',
    'The top-level object must use the key "issues".',
    'Each issue must be publication-ready and satisfy the Premortem issue quality bar.',
    'Do not wrap the JSON in markdown fences.',
    '',
    'canonical_findings:',
    JSON.stringify(input.canonicalFindings, null, 2),
    '',
    'dedupe_clusters:',
    JSON.stringify(input.dedupeClusters, null, 2)
  ].join('\n');

  return [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: userPrompt }
  ];
}
