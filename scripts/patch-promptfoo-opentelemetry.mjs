import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const promptfooEntry = require.resolve('promptfoo');

function findPackageRoot(startPath) {
  let current = path.dirname(startPath);
  while (current !== path.dirname(current)) {
    const candidate = path.join(current, 'package.json');
    if (fs.existsSync(candidate)) {
      return current;
    }
    current = path.dirname(current);
  }
  throw new Error(`Could not locate package root from ${startPath}`);
}

const promptfooRoot = findPackageRoot(promptfooEntry);

const filesToPatch = [
  path.join(promptfooRoot, 'index.js'),
  path.join(promptfooRoot, 'server/index.js'),
  path.join(promptfooRoot, 'evaluator-CM_f4JnS.js')
];

const namedImport = 'import { resourceFromAttributes } from "@opentelemetry/resources";';
const defaultImport =
  'import otelResources from "@opentelemetry/resources";\nconst { resourceFromAttributes } = otelResources;';

let patched = 0;

for (const filePath of filesToPatch) {
  if (!fs.existsSync(filePath)) continue;
  const original = fs.readFileSync(filePath, 'utf8');
  if (!original.includes(namedImport)) continue;

  const updated = original.replace(namedImport, defaultImport);
  if (updated !== original) {
    fs.writeFileSync(filePath, updated);
    patched += 1;
  }
}

if (patched === 0) {
  console.log(
    JSON.stringify({
      status: 'noop',
      promptfooRoot,
      message: 'No promptfoo OpenTelemetry import patch was needed.'
    })
  );
} else {
  console.log(
    JSON.stringify({
      status: 'patched',
      promptfooRoot,
      filesPatched: patched
    })
  );
}
