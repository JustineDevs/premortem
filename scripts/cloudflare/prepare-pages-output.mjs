import { existsSync, readdirSync, renameSync, rmSync } from 'node:fs';
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

const workerPath = path.join(targetDir, 'worker.js');
const pagesWorkerPath = path.join(targetDir, '_worker.js');
if (existsSync(workerPath)) {
  rmSync(pagesWorkerPath, { force: true });
  execFileSync('mv', [workerPath, pagesWorkerPath], { stdio: 'inherit' });
}

const assetsDir = path.join(targetDir, 'assets');
if (existsSync(assetsDir)) {
  for (const entry of readdirSync(assetsDir, { withFileTypes: true })) {
    const from = path.join(assetsDir, entry.name);
    const to = path.join(targetDir, entry.name);
    if (existsSync(to)) {
      rmSync(to, { recursive: true, force: true });
    }
    renameSync(from, to);
  }
  rmSync(assetsDir, { recursive: true, force: true });
}

console.log(`Prepared Cloudflare Pages output at ${path.relative(repoRoot, targetDir)}`);
