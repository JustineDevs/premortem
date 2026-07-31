import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

interface SuiteConfig {
  name: string;
  config: string;
  output: string;
  threshold: number;
}

const packageRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const repoRoot = path.resolve(packageRoot, '..', '..');

const suites: SuiteConfig[] = [
  {
    name: 'finding-synthesizer',
    config: 'packages/evals/promptfoo/promptfooconfig.yaml',
    output: 'packages/evals/promptfoo/results.finding-synthesizer.json',
    threshold: 0.95
  },
  {
    name: 'issue-validator',
    config: 'packages/evals/promptfoo/promptfooconfig.validator.yaml',
    output: 'packages/evals/promptfoo/results.issue-validator.json',
    threshold: 0.95
  },
  {
    name: 'specialist-floor',
    config: 'packages/evals/promptfoo/promptfooconfig.floor.yaml',
    output: 'packages/evals/promptfoo/results.specialist-floor.json',
    threshold: 1
  }
];

function parseArgs(argv: string[]) {
  const configs: string[] = [];
  const suitesRequested: string[] = [];

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--config' && argv[index + 1]) {
      configs.push(argv[++index]!);
      continue;
    }
    if (arg === '--suite' && argv[index + 1]) {
      suitesRequested.push(argv[++index]!);
      continue;
    }
    if (arg.startsWith('--suite=')) {
      suitesRequested.push(arg.slice('--suite='.length));
      continue;
    }
    if (arg.startsWith('--config=')) {
      configs.push(arg.slice('--config='.length));
      continue;
    }
  }

  return {
    configs,
    suitesRequested
  };
}

function run(command: string, args: string[], cwd = repoRoot) {
  const result = spawnSync(command, args, {
    cwd,
    stdio: 'inherit',
    env: process.env
  });

  if (result.error) {
    throw result.error;
  }
  if (result.status !== 0) {
    throw new Error(`${command} ${args.join(' ')} exited with code ${result.status ?? 1}`);
  }
}

function resolveSuites(argv: string[]) {
  const { configs, suitesRequested } = parseArgs(argv);
  if (configs.length > 0) {
    return suites.filter((suite) => configs.includes(suite.config));
  }

  if (suitesRequested.length > 0) {
    return suites.filter((suite) => suitesRequested.includes(suite.name));
  }

  return suites;
}

async function main() {
  const selectedSuites = resolveSuites(process.argv.slice(2));
  if (selectedSuites.length === 0) {
    throw new Error('No promptfoo suites selected for evaluation.');
  }

  run('pnpm', ['--filter', '@premortem/agent-kit', 'build']);
  run('pnpm', ['--filter', '@premortem/llm', 'build']);
  run('pnpm', ['--filter', '@premortem/observability', 'build']);
  run('pnpm', ['--filter', '@premortem/evals', 'build']);
  run('tsx', ['--tsconfig', 'tsconfig.base.json', './scripts/patch-promptfoo-opentelemetry.ts']);

  for (const suite of selectedSuites) {
    run('promptfoo', ['validate', 'config', '-c', suite.config]);
  }

  for (const suite of selectedSuites) {
    run('promptfoo', [
      'eval',
      '-c',
      suite.config,
      '-o',
      suite.output,
      '--max-concurrency',
      '1'
    ]);
    run('tsx', [
      '--tsconfig',
      'tsconfig.base.json',
      './scripts/verify-promptfoo-threshold.ts',
      suite.output,
      String(suite.threshold)
    ]);
  }
}

void main();
