import type { StdioConnectionParams } from '@google/adk';
import { isPhoenixEnabled, resolvePhoenixMcpBaseUrl } from '@premortem/observability';

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
