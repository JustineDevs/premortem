#!/usr/bin/env node
import { access, mkdir } from 'node:fs/promises';
import { constants } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';

const repoRoot = resolve(fileURLToPath(new URL('../..', import.meta.url)));
const cacheDir = join(repoRoot, '.cache', 'devtools', 'trufflehog');
const binaryPath = join(cacheDir, 'trufflehog');
const excludePath = join(repoRoot, 'scripts', 'devtools', 'trufflehog-exclude-paths.txt');
const dockerRepoRoot = '/workdir';
const dockerExcludePath = '/workdir/scripts/devtools/trufflehog-exclude-paths.txt';

const trufflehogArgs = process.argv.slice(2);
const defaultArgs = [
  'filesystem',
  repoRoot,
  '--results=verified',
  '--fail',
  '--fail-on-scan-errors',
  '--no-update',
  '--force-skip-binaries',
  '--force-skip-archives',
  '--exclude-paths',
  excludePath
];

async function fileExists(path) {
  try {
    await access(path, constants.X_OK);
    return true;
  } catch {
    return false;
  }
}

async function ensureBinary() {
  if (await fileExists(binaryPath)) {
    return binaryPath;
  }

  await mkdir(cacheDir, { recursive: true });

  try {
    execFileSync(
      'bash',
      [
        '-lc',
        `curl -sSfL https://raw.githubusercontent.com/trufflesecurity/trufflehog/main/scripts/install.sh | sh -s -- -b "${cacheDir}"`
      ],
      {
        cwd: repoRoot,
        stdio: 'inherit'
      }
    );
    return binaryPath;
  } catch (error) {
    console.warn(
      '[trufflehog] local install via TruffleHog install script failed, falling back to Docker:',
      error?.message ?? error
    );
    return null;
  }
}

function runWithBinary(executable) {
  execFileSync(executable, trufflehogArgs.length > 0 ? trufflehogArgs : defaultArgs, {
    cwd: repoRoot,
    stdio: 'inherit'
  });
}

function runWithDocker() {
  const toDockerArg = (arg) => {
    if (arg === repoRoot) return dockerRepoRoot;
    if (arg === excludePath) return dockerExcludePath;
    return arg;
  };

  const dockerArgs = [
    'run',
    '--rm',
    '-v',
    `${repoRoot}:${dockerRepoRoot}`,
    '-w',
    dockerRepoRoot,
    'trufflesecurity/trufflehog:latest',
    ...(trufflehogArgs.length > 0 ? trufflehogArgs.map(toDockerArg) : defaultArgs.map(toDockerArg))
  ];

  execFileSync('docker', dockerArgs, {
    cwd: repoRoot,
    stdio: 'inherit'
  });
}

const binary = await ensureBinary();
if (binary) {
  runWithBinary(binary);
} else {
  runWithDocker();
}
