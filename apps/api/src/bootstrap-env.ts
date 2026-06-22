import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { hasConfiguredRuntimeCredentials, validateProductionBootEnv } from '@premortem/domain';
import { captureServerMessage } from '@premortem/observability/server';

import { loadPremortemLocalEnv } from './lib/load-local-env';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
loadPremortemLocalEnv(repoRoot);

if (process.env.PREMORTEM_PRODUCTION_MODE !== '1' && !hasConfiguredRuntimeCredentials()) {
  process.env.PREMORTEM_INGEST_LOCAL ??= '1';
}

const missingProductionEnv = validateProductionBootEnv();
if (missingProductionEnv.length > 0) {
  const message = `[premortem-api] Invalid production boot environment: ${missingProductionEnv.join(', ')}`;
  if (process.env.PREMORTEM_PRODUCTION_MODE === '1') {
    throw new Error(message);
  }
  captureServerMessage(message, 'warning');
}
