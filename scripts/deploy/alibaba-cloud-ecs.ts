#!/usr/bin/env node

import { setTimeout as sleep } from 'node:timers/promises';

type DeploymentSummary = {
  provider: 'Alibaba Cloud';
  deploymentTarget: 'ecs';
  buildStrategy: 'runner-built-image';
  rolloutStrategy: 'single-container-with-rollback';
  instanceId: string | null;
  regionId: string | null;
  host: string | null;
  publicUrl: string | null;
  apiPort: number;
};

function readEnv(name: string): string | null {
  const value = process.env[name]?.trim();
  return value ? value : null;
}

function resolveSummary(): DeploymentSummary {
  return {
    provider: 'Alibaba Cloud',
    deploymentTarget: 'ecs',
    buildStrategy: 'runner-built-image',
    rolloutStrategy: 'single-container-with-rollback',
    instanceId: readEnv('ALIBABA_CLOUD_ECS_INSTANCE_ID'),
    regionId: readEnv('ALIBABA_CLOUD_REGION_ID'),
    host: readEnv('ALIBABA_CLOUD_ECS_HOST'),
    publicUrl: readEnv('ALIBABA_CLOUD_ECS_PUBLIC_URL'),
    apiPort: Number.parseInt(process.env.PREMORTEM_API_PORT ?? '18787', 10)
  };
}

async function probeEcsMetadata() {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 2500);

  try {
    const [instanceId, regionId] = await Promise.all([
      fetch('http://100.100.100.200/latest/meta-data/instance-id', {
        signal: controller.signal
      })
        .then(async (response) => (response.ok ? (await response.text()).trim() : null))
        .catch(() => null),
      fetch('http://100.100.100.200/latest/meta-data/region-id', {
        signal: controller.signal
      })
        .then(async (response) => (response.ok ? (await response.text()).trim() : null))
        .catch(() => null)
    ]);

    return { instanceId, regionId };
  } finally {
    clearTimeout(timeout);
  }
}

async function main() {
  const summary = resolveSummary();
  const metadata = await probeEcsMetadata();

  if (!summary.host && !summary.publicUrl) {
    console.warn(
      'Alibaba Cloud ECS deploy helper: set ALIBABA_CLOUD_ECS_HOST or ALIBABA_CLOUD_ECS_PUBLIC_URL to make this actionable.'
    );
  }

  console.log(
    JSON.stringify(
      {
        ...summary,
        runtimeOnly: true,
        buildOnHost: false,
        rollbackSupported: true,
        ecsMetadata: metadata,
        healthUrl:
          summary.publicUrl ?? (summary.host ? `http://${summary.host}:${summary.apiPort}` : null)
      },
      null,
      2
    )
  );

  await sleep(0);
}

void main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
