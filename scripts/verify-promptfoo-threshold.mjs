import fs from 'node:fs';
import path from 'node:path';

function readJson(filePath) {
  const raw = fs.readFileSync(filePath, 'utf8');
  return JSON.parse(raw);
}

function extractStats(output) {
  const results = output?.results ?? output;
  const stats = results?.stats ?? output?.stats ?? null;
  if (stats && typeof stats === 'object') {
    const successes = Number(stats.successes ?? 0);
    const failures = Number(stats.failures ?? 0);
    const errors = Number(stats.errors ?? 0);
    const total = successes + failures + errors;
    if (Number.isFinite(total) && total > 0) {
      return { successes, failures, errors, total };
    }
  }

  const rows = Array.isArray(results?.results)
    ? results.results
    : Array.isArray(output?.results)
      ? output.results
      : [];

  const successes = rows.filter((row) => row && typeof row === 'object' && row.success === true).length;
  const failures = rows.filter((row) => row && typeof row === 'object' && row.success === false).length;
  const errors = rows.filter((row) => row && typeof row === 'object' && row.error).length;
  const total = rows.length;
  return { successes, failures, errors, total };
}

const filePath = process.argv[2];
const minimumScore = Number.parseFloat(process.argv[3] ?? '0.95');

if (!filePath) {
  console.error('Usage: node scripts/verify-promptfoo-threshold.mjs <results.json> [minimumScore]');
  process.exit(1);
}

const resolvedPath = path.resolve(filePath);
if (!fs.existsSync(resolvedPath)) {
  console.error(`Promptfoo results file not found: ${resolvedPath}`);
  process.exit(1);
}

const output = readJson(resolvedPath);
const { successes, failures, errors, total } = extractStats(output);

if (total === 0) {
  console.error(`Promptfoo results file contains no evaluated tests: ${resolvedPath}`);
  process.exit(1);
}

const score = successes / total;
console.log(
  JSON.stringify(
    {
      filePath: resolvedPath,
      successes,
      failures,
      errors,
      total,
      score,
      minimumScore
    },
    null,
    2
  )
);

if (score < minimumScore) {
  console.error(`Prompt regression gate failed: score ${score.toFixed(4)} < ${minimumScore.toFixed(4)}`);
  process.exit(1);
}
