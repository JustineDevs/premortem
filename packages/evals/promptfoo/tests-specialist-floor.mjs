import fs from 'node:fs/promises';
import path from 'node:path';

const PROMPT_DIR = path.resolve(process.cwd(), '.agents/prompts');
const IGNORED_PROMPTS = new Set(['workflow-contract.md', 'specialist-floor.md']);

function normalizeWhitespace(value) {
  return String(value ?? '').replace(/\s+/g, ' ').trim();
}

function excerptPrompt(text, maxLength = 160) {
  return normalizeWhitespace(text).slice(0, maxLength);
}

async function loadPromptFiles() {
  const entries = await fs.readdir(PROMPT_DIR, { withFileTypes: true });
  return entries
    .filter((entry) => entry.isFile() && entry.name.endsWith('.md') && !IGNORED_PROMPTS.has(entry.name))
    .map((entry) => entry.name)
    .sort((left, right) => left.localeCompare(right));
}

export default async function generateSpecialistFloorTests() {
  const promptFiles = await loadPromptFiles();
  const tests = [];

  for (const fileName of promptFiles) {
    const promptPath = `.agents/prompts/${fileName}`;
    const rawPrompt = await fs.readFile(path.join(PROMPT_DIR, fileName), 'utf8');
    const promptExcerpt = excerptPrompt(rawPrompt);

    tests.push({
      description: `Prompt floor regression: ${fileName} keeps the shared floor and original prompt body`,
      vars: {
        promptPath,
        promptExcerpt
      },
      assert: [
        {
          type: 'javascript',
          value: [
            'const normalize = (value) => String(value ?? "").replace(/\\s+/g, " ").trim();',
            'return normalize(output).includes("Premortem Specialist Production Floor");'
          ].join('\n')
        },
        {
          type: 'javascript',
          value: [
            'const normalize = (value) => String(value ?? "").replace(/\\s+/g, " ").trim();',
            'return normalize(output).includes("0.85");'
          ].join('\n')
        },
        {
          type: 'javascript',
          value: [
            'const normalized = String(output ?? "").toLowerCase();',
            'return normalized.includes("return the empty envelope") && normalized.includes("no extra commentary");'
          ].join('\n')
        },
        {
          type: 'javascript',
          value: [
            'const normalized = String(output ?? "").replace(/\\s+/g, " ").trim();',
            'const normalize = (value) => String(value ?? "").replace(/\\s+/g, " ").trim();',
            'return normalized.includes("Premortem Workflow Contract") && normalized.includes(normalize(context.vars.promptExcerpt));'
          ].join('\n')
        }
      ]
    });
  }

  return tests;
}
