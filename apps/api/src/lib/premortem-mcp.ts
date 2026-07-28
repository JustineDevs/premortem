import { randomUUID } from 'node:crypto';

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { WebStandardStreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js';

import {
  getAuthScopes,
  registerPremortemToolsOnSdkServer,
  type PremortemMcpRuntimeEnv,
  type PremortemMcpActorContext
} from '@premortem/mcp';

import { resolveApiActorContext } from './request-context.js';
import type { AppEnv } from './types.js';

type PremortemMcpState = {
  server: McpServer;
  transport: WebStandardStreamableHTTPServerTransport;
};

let mcpStatePromise: Promise<PremortemMcpState> | null = null;

function createPremortemMcpServer(env: PremortemMcpRuntimeEnv = {}) {
  const server = new McpServer(
    { name: 'premortem-mcp', version: '0.1.0' },
    {
      capabilities: {
        tools: {}
      },
      instructions:
        'Premortem MCP exposes authenticated workspace, audit, and billing tools. All tools are org-scoped and role-gated.'
    }
  );

  registerPremortemToolsOnSdkServer(server, env);

  return server;
}

async function getPremortemMcpState(env: AppEnv = {}) {
  if (!mcpStatePromise) {
    mcpStatePromise = (async () => {
      const server = createPremortemMcpServer(env as PremortemMcpRuntimeEnv);
      const transport = new WebStandardStreamableHTTPServerTransport({
        sessionIdGenerator: () => randomUUID()
      });
      await server.connect(transport);
      return { server, transport };
    })();
  }

  return mcpStatePromise;
}

function toMcpAuthInfo(actor: PremortemMcpActorContext, token: string) {
  return {
    token,
    clientId: actor.profileId,
    scopes: getAuthScopes(actor.role),
    extra: {
      actor
    }
  };
}

export async function handlePremortemMcpRequest(request: Request, env: AppEnv = {}) {
  const actor = await resolveApiActorContext(request);
  const { transport } = await getPremortemMcpState(env);
  return transport.handleRequest(request, {
    authInfo: toMcpAuthInfo(
      {
        profileId: actor.profileId,
        organizationId: actor.organizationId,
        role: actor.role,
        email: actor.email ?? null,
        source: 'supabase'
      },
      `${actor.profileId}:${actor.organizationId}`
    )
  });
}
