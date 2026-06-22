import type { StdioConnectionParams } from '@google/adk';

function isPhoenixEnabled() {
  return Boolean(
    process.env.PHOENIX_API_KEY?.trim() ||
      process.env.PHOENIX_COLLECTOR_ENDPOINT?.trim() ||
      process.env.PHOENIX_OTEL_ENABLED === '1'
  );
}

function resolvePhoenixMcpBaseUrl() {
  const configured = process.env.PHOENIX_MCP_BASE_URL?.trim();
  if (configured) return configured.replace(/\/$/, '');

  const collector = process.env.PHOENIX_COLLECTOR_ENDPOINT?.trim();
  if (collector) {
    const withoutTraces = collector.replace(/\/v1\/traces\/?$/, '').replace(/\/$/, '');
    if (withoutTraces.includes('/s/')) return withoutTraces;
  }

  return 'https://app.phoenix.arize.com';
}

export function buildPhoenixMcpConnection(): StdioConnectionParams | null {
  if (!isPhoenixEnabled()) return null;

  const apiKey = process.env.PHOENIX_API_KEY?.trim();
  if (!apiKey) return null;

  const baseUrl = resolvePhoenixMcpBaseUrl();

  return {
    type: 'StdioConnectionParams',
    serverParams: {
      command: 'npx',
      args: ['-y', '@arizeai/phoenix-mcp@latest', '--baseUrl', baseUrl, '--apiKey', apiKey],
      env: {
        PHOENIX_API_KEY: apiKey,
        PHOENIX_COLLECTOR_ENDPOINT: baseUrl
      }
    }
  };
}

export function describePhoenixRuntime() {
  return {
    enabled: isPhoenixEnabled(),
    projectName: process.env.PHOENIX_PROJECT_NAME?.trim() || 'premortem',
    mcpBaseUrl: resolvePhoenixMcpBaseUrl(),
    mcpConfigured: Boolean(buildPhoenixMcpConnection())
  };
}
