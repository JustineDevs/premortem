import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { applySupabaseDatabaseEnv } from '../packages/db/supabase-database-url.mjs';

/**
 * Resolve monorepo root (package name "premortem") from any caller path.
 */
export function resolvePremortemRepoRoot(startDir = process.cwd()) {
  let current = path.resolve(startDir);

  while (true) {
    const packageJsonPath = path.join(current, 'package.json');
    if (fs.existsSync(packageJsonPath)) {
      try {
        const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
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

/**
 * Load repo-root `.env.local` then `.env` into process.env (without overriding existing values).
 */
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

/** Read one key from repo `.env.local` / `.env` (file wins over inherited shell for dev tooling). */
export function readPremortemLocalEnvValue(key, repoRoot = resolvePremortemRepoRoot()) {
  for (const fileName of ['.env.local', '.env']) {
    const absolutePath = path.join(repoRoot, fileName);
    if (!fs.existsSync(absolutePath)) continue;

    for (const line of fs.readFileSync(absolutePath, 'utf8').split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const match = trimmed.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
      if (!match || match[1] !== key) continue;

      let value = match[2].trim();
      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1);
      }
      return value;
    }
  }

  return undefined;
}

/** Apply selected keys from disk so `.env.local` wins over stale shell exports in dev scripts. */
export function applyPremortemLocalEnvFileOverrides(keys, repoRoot = resolvePremortemRepoRoot()) {
  for (const key of keys) {
    const value = readPremortemLocalEnvValue(key, repoRoot);
    if (value !== undefined) {
      process.env[key] = value;
    }
  }
}

const isDirectRun =
  process.argv[1] &&
  path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url));

if (isDirectRun) {
  const root = loadPremortemLocalEnv();
  console.log(JSON.stringify({ ok: true, repoRoot: root }, null, 2));
}
