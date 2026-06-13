import { existsSync, rmSync } from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const sourceDir = path.join(repoRoot, 'apps/web/.open-next');
const targetDir = path.join(repoRoot, '.cloudflare-pages');

if (!existsSync(sourceDir)) {
  throw new Error(`Missing OpenNext output directory: ${sourceDir}`);
}

rmSync(targetDir, { recursive: true, force: true });
execFileSync('cp', ['-RL', sourceDir, targetDir], { stdio: 'inherit' });

console.log(`Prepared Cloudflare Pages output at ${path.relative(repoRoot, targetDir)}`);
