import fs from 'node:fs';
import path from 'node:path';

import { applySupabaseDatabaseEnv } from '@premortem/db';

export function resolvePremortemRepoRoot(startDir = process.cwd()) {
  let current = path.resolve(startDir);

  while (true) {
    const packageJsonPath = path.join(current, 'package.json');
    if (fs.existsSync(packageJsonPath)) {
      try {
        const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8')) as { name?: string };
        if (packageJson.name === 'premortem') {
          return current;
        }
      } catch {
        // keep walking
      }
    }

    const parent = path.dirname(current);
    if (parent === current) {
      return startDir;
    }
    current = parent;
  }
}

/** Load repo-root `.env.local` then `.env` without overriding existing values. */
export function loadPremortemLocalEnv(repoRoot = resolvePremortemRepoRoot()) {
  for (const fileName of ['.env.local', '.env']) {
    const absolutePath = path.join(repoRoot, fileName);
    if (!fs.existsSync(absolutePath)) continue;

    const lines = fs.readFileSync(absolutePath, 'utf8').split(/\r?\n/);
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;

      const match = trimmed.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
      if (!match) continue;

      const [, key, rawValue] = match;
      if (process.env[key] !== undefined) continue;

      let value = rawValue.trim();
      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1);
      }

      process.env[key] = value;
    }
  }

  applySupabaseDatabaseEnv(process.env);
  return repoRoot;
}
