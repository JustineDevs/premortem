#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const SECRET_KEY_PATTERN =
  /(^|_)(API_KEY|API_TOKEN|SECRET|SECRET_KEY|TOKEN|PASSWORD|PRIVATE_KEY|PRIVATE_TOKEN|CLIENT_SECRET|SERVICE_ROLE_KEY|WEBHOOK_SECRET|DATABASE_URL|DIRECT_URL)$/i;

function resolveRepoRoot() {
  return path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
}

function shouldStripKey(key) {
  if (key.startsWith('NEXT_PUBLIC_')) return false;
  return SECRET_KEY_PATTERN.test(key);
}

function sanitizeNextEnvFile(filePath) {
  if (!fs.existsSync(filePath)) {
    return { removed: [], retained: [] };
  }

  const source = fs.readFileSync(filePath, 'utf8');
  const blockPattern = /^export const (production|development|test) = (.*?);\s*$/gm;
  let changed = false;
  const removed = [];
  const retained = [];

  const sanitized = source.replace(blockPattern, (full, mode, jsonText) => {
    const envObject = JSON.parse(jsonText);
    const nextEnvObject = {};

    for (const [key, value] of Object.entries(envObject)) {
      if (shouldStripKey(key)) {
        removed.push(`${mode}:${key}`);
        changed = true;
        continue;
      }
      retained.push(`${mode}:${key}`);
      nextEnvObject[key] = value;
    }

    return `export const ${mode} = ${JSON.stringify(nextEnvObject)};`;
  });

  if (changed) {
    fs.writeFileSync(filePath, `${sanitized.endsWith('\n') ? sanitized : `${sanitized}\n`}`);
  }

  return { removed, retained };
}

export function sanitizeOpenNextEnvPaths(paths) {
  const summaries = [];
  for (const filePath of paths) {
    summaries.push({ filePath, ...sanitizeNextEnvFile(filePath) });
  }
  return summaries;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const repoRoot = resolveRepoRoot();
  const targets = process.argv.slice(2);
  const resolvedTargets =
    targets.length > 0
      ? targets
      : [
          path.join(repoRoot, 'apps/web/.open-next/cloudflare/next-env.mjs'),
          path.join(repoRoot, '.cloudflare-pages/cloudflare/next-env.mjs')
        ];

  const summaries = sanitizeOpenNextEnvPaths(resolvedTargets);
  console.log(JSON.stringify({ ok: true, summaries }, null, 2));
}
