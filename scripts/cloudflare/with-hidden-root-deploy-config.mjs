import { existsSync, renameSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const ROOT_DEPLOY_CONFIG = join(ROOT, '.wrangler/deploy/config.json');
const ROOT_DEPLOY_CONFIG_BACKUP = join(ROOT, '.wrangler/deploy/config.json.pages-backup');

export function withHiddenRootDeployConfig(callback) {
  const shouldHide = existsSync(ROOT_DEPLOY_CONFIG);

  if (shouldHide) {
    renameSync(ROOT_DEPLOY_CONFIG, ROOT_DEPLOY_CONFIG_BACKUP);
  }

  try {
    return callback();
  } finally {
    if (shouldHide && existsSync(ROOT_DEPLOY_CONFIG_BACKUP)) {
      renameSync(ROOT_DEPLOY_CONFIG_BACKUP, ROOT_DEPLOY_CONFIG);
    }
  }
}
