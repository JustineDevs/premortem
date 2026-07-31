#!/usr/bin/env node
import { spawn } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const ROOT_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const SHOULD_DEPLOY = process.argv.includes('--deploy');
const LIGHT_MODE = process.argv.includes('--light');
const FREEZE_SAFE_MODE = process.argv.includes('--freeze-safe');
const WEB_PORT = process.env.PREMORTEM_WEB_PORT ?? '13000';
const API_PORT = process.env.PREMORTEM_API_PORT ?? '18787';
const LOCAL_POSTGRES_URL = 'postgresql://postgres:postgres@127.0.0.1:5432/premortem';
const VERCEL_PROJECT_CONFIG_PATH = path.resolve(ROOT_DIR, '.vercel/project.json');

type Step = {
  name: string;
  command: string;
  args: string[];
  env?: NodeJS.ProcessEnv;
};

type BackgroundProcess = {
  label: string;
  child: ReturnType<typeof spawn>;
};

export function verificationStepEnv(stepEnv: NodeJS.ProcessEnv | undefined = undefined): NodeJS.ProcessEnv {
  return {
    ...process.env,
    ...stepEnv,
    CI: '1',
    TURBO_CONCURRENCY: stepEnv?.TURBO_CONCURRENCY ?? '1',
    TURBO_TELEMETRY_DISABLED: '1'
  };
}

function runStep(step: Step): Promise<void> {
  return new Promise((resolve, reject) => {
    process.stdout.write(`\n==> ${step.name}\n`);
    const child = spawn(step.command, step.args, {
      cwd: ROOT_DIR,
      env: verificationStepEnv(step.env),
      stdio: 'inherit',
      shell: process.platform === 'win32'
    });

    child.on('error', (error) => {
      reject(new Error(`${step.name} failed to start: ${error.message}`));
    });

    child.on('exit', (code, signal) => {
      if (code === 0) {
        resolve();
        return;
      }

      const suffix = signal ? ` (signal ${signal})` : '';
      reject(new Error(`${step.name} failed with exit code ${code ?? 'unknown'}${suffix}`));
    });
  });
}

function spawnBackground(step: Step): BackgroundProcess {
  process.stdout.write(`\n==> ${step.name}\n`);
  const child = spawn(step.command, step.args, {
    cwd: ROOT_DIR,
    env: verificationStepEnv(step.env),
    stdio: 'inherit',
    shell: process.platform === 'win32'
  });

  child.on('error', (error) => {
    console.error(`${step.name} failed to start: ${error.message}`);
  });

  return { label: step.name, child };
}

async function waitForOk(url: string, timeoutMs = 180000): Promise<void> {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    try {
      const response = await fetch(url, { cache: 'no-store' });
      if (response.ok) return;
    } catch {
      // retry
    }
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
  throw new Error(`Timed out waiting for ${url}`);
}

async function ensureSmokeRuntime(): Promise<BackgroundProcess | null> {
  if (LIGHT_MODE || FREEZE_SAFE_MODE) return null;

  const dev = spawnBackground({
    name: 'pnpm run dev (smoke runtime)',
    command: 'pnpm',
    args: ['run', 'dev'],
    env: {
      ...process.env,
      DATABASE_URL: process.env.DATABASE_URL ?? LOCAL_POSTGRES_URL,
      DIRECT_URL: process.env.DIRECT_URL ?? LOCAL_POSTGRES_URL,
      PREMORTEM_PRODUCTION_MODE: process.env.PREMORTEM_PRODUCTION_MODE ?? '1',
      PREMORTEM_SKIP_DB_MIGRATE: '1',
      PREMORTEM_WEB_PORT: WEB_PORT,
      PREMORTEM_API_PORT: API_PORT
    }
  });

  await waitForOk(`http://127.0.0.1:${API_PORT}/health`);
  await waitForOk(`http://127.0.0.1:${WEB_PORT}/api/health`);
  return dev;
}

function killBackground(processRef: BackgroundProcess | null): void {
  if (!processRef) return;

  processRef.child.kill('SIGTERM');
  setTimeout(() => {
    if (!processRef.child.killed) {
      processRef.child.kill('SIGKILL');
    }
  }, 5000).unref?.();
}

export function buildChecks(options: { freezeSafe?: boolean } = {}): Step[] {
  const freezeSafe = options.freezeSafe ?? FREEZE_SAFE_MODE;
  const steps: Step[] = [
    { name: 'pnpm run lint', command: 'pnpm', args: ['run', 'lint'] },
    { name: 'pnpm run typecheck', command: 'pnpm', args: ['run', 'typecheck'] },
    { name: 'pnpm run build', command: 'pnpm', args: ['run', 'build'] },
    { name: 'pnpm run verify:env', command: 'pnpm', args: ['run', 'verify:env'] }
  ];

  if (!freezeSafe) {
    steps.splice(3, 0, { name: 'pnpm run eval:prompts', command: 'pnpm', args: ['run', 'eval:prompts'] });
  }

  return steps;
}

function smokeValidationEnv(): NodeJS.ProcessEnv {
  return {
    ...process.env,
    DATABASE_URL: process.env.DATABASE_URL ?? LOCAL_POSTGRES_URL,
    DIRECT_URL: process.env.DIRECT_URL ?? LOCAL_POSTGRES_URL,
    PREMORTEM_PRODUCTION_MODE: '1',
    PREMORTEM_SKIP_DOCKER: process.env.PREMORTEM_SKIP_DOCKER ?? '1',
    PREMORTEM_WEB_PORT: WEB_PORT,
    PREMORTEM_API_PORT: API_PORT
  };
}

async function deployToVercel(): Promise<void> {
  const vercelToken = process.env.VERCEL_TOKEN?.trim();
  const projectConfig = JSON.parse(readFileSync(VERCEL_PROJECT_CONFIG_PATH, 'utf8')) as {
    orgId?: string;
    projectId?: string;
  };
  const vercelOrgId = process.env.VERCEL_ORG_ID?.trim() ?? projectConfig.orgId?.trim();
  const vercelProjectId = process.env.VERCEL_PROJECT_ID?.trim() ?? projectConfig.projectId?.trim();

  if (!vercelOrgId) {
    throw new Error('VERCEL_ORG_ID is required to trigger a production deployment.');
  }
  if (!vercelProjectId) {
    throw new Error('VERCEL_PROJECT_ID is required to trigger a production deployment.');
  }

  const args = ['dlx', 'vercel@latest', 'deploy', '--prod', '--yes'];
  if (vercelToken) {
    args.push('--token', vercelToken);
  }

  await runStep({
    name: 'Vercel production deploy',
    command: 'pnpm',
    args,
    env: {
      VERCEL_ORG_ID: vercelOrgId,
      VERCEL_PROJECT_ID: vercelProjectId
    }
  });
}

async function main(): Promise<void> {
  process.stdout.write(`Running release preflight checks${FREEZE_SAFE_MODE ? ' (freeze-safe)' : ''}...\n`);
  for (const step of buildChecks()) {
    await runStep(step);
  }

  const runtime = await ensureSmokeRuntime();
  try {
    if (!LIGHT_MODE) {
      await runStep({
        name: 'pnpm run smoke:verify-auth-loopback',
        command: 'pnpm',
        args: ['run', 'smoke:verify-auth-loopback'],
        env: smokeValidationEnv()
      });
      await runStep({
        name: 'pnpm run smoke:production-readiness',
        command: 'pnpm',
        args: ['run', 'smoke:production-readiness'],
        env: smokeValidationEnv()
      });
    }
  } finally {
    killBackground(runtime);
  }

  process.stdout.write('\nRelease preflight checks passed.\n');

  if (SHOULD_DEPLOY) {
    await deployToVercel();
    process.stdout.write('\nVercel deployment triggered successfully.\n');
  }
}

const isMainModule = path.resolve(process.argv[1] ?? '') === fileURLToPath(import.meta.url);

if (isMainModule) {
  void main().catch((error) => {
    console.error('\nRelease preflight failed.');
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
}
