import { assertCoreObservabilityConfigured } from '@premortem/observability/boot';
import { initServerObservability } from '@premortem/observability/server';

export async function register() {
  assertCoreObservabilityConfigured();
  await initServerObservability('premortem-web');
}
