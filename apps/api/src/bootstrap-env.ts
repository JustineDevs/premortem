import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { hasConfiguredRuntimeCredentials, validateProductionBootEnv } from '@premortem/domain';
import { assertCoreObservabilityConfigured } from '@premortem/observability/boot';

import { loadPremortemLocalEnv } from './lib/load-local-env.js';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
loadPremortemLocalEnv(repoRoot);

if (process.env.PREMORTEM_PRODUCTION_MODE !== '1' && !hasConfiguredRuntimeCredentials()) {
  process.env.PREMORTEM_INGEST_LOCAL ??= '1';
}

const missingProductionEnv = validateProductionBootEnv();
if (missingProductionEnv.length > 0) {
  throw new Error(
    `[premortem-api] Invalid production boot environment: ${missingProductionEnv.join(', ')}`
  );
}

assertCoreObservabilityConfigured();
