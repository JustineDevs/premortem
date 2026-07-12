import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

function resolveRepoRoot(): string {
  const explicit = process.env.PREMORTEM_ROOT_DIR?.trim();
  if (explicit) return explicit;

  let current = process.cwd();
  while (true) {
    const packageJsonPath = path.join(current, 'package.json');
    if (fs.existsSync(packageJsonPath)) {
      try {
        const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8')) as {
          name?: string;
        };
        if (packageJson.name === 'premortem') return current;
      } catch {
        // keep walking upward
      }
    }

    const parent = path.dirname(current);
    if (parent === current) {
      return process.cwd();
    }
    current = parent;
  }
}

const repoRoot = resolveRepoRoot();
const SCRIPTS_DIR = path.resolve(repoRoot, 'packages/graphiti/src');

function resolvePythonBinary(): string {
  const explicit = process.env.GRAPHITI_PYTHON?.trim();
  if (explicit) return explicit;

  const repoVenvPython = path.resolve(repoRoot, 'packages/graphiti/.venv/bin/python');
  return repoVenvPython;
}

function runPythonScript(script: string, payload: unknown): Promise<string> {
  return new Promise((resolve, reject) => {
    const python = resolvePythonBinary();
    const proc = spawn(python, [path.join(SCRIPTS_DIR, script)], {
      env: { ...process.env },
      stdio: ['pipe', 'pipe', 'pipe']
    });

    let stdout = '';
    let stderr = '';

    proc.stdin.end(JSON.stringify(payload));
    proc.stdout.on('data', (chunk: Buffer) => {
      stdout += chunk.toString();
    });
    proc.stderr.on('data', (chunk: Buffer) => {
      stderr += chunk.toString();
    });
    proc.on('error', reject);
    proc.on('close', (code) => {
      if (code !== 0) {
        reject(new Error(`graphiti script failed via ${python}: ${stderr.trim() || `exit code ${code}`}`));
        return;
      }
      resolve(stdout);
    });
  });
}

export async function writeEpisode(payload: {
  name: string;
  body: string;
  source_description: string;
  reference_time: string;
  project_id: string;
}): Promise<void> {
  await runPythonScript('write_episode.py', payload);
}

export interface GraphitiEdge {
  uuid: string;
  fact: string;
  valid_at: string | null;
  invalid_at: string | null;
}

export async function searchEpisodes(payload: {
  query: string;
  project_id: string;
  num_results?: number;
}): Promise<GraphitiEdge[]> {
  const raw = await runPythonScript('search_episodes.py', payload);
  const parsed = JSON.parse(raw) as GraphitiEdge[];
  return Array.isArray(parsed) ? parsed : [];
}
