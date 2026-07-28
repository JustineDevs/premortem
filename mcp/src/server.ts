import { MCPServer, oauthSupabaseProvider } from 'mcp-use/server';

import { registerPremortemToolsOnMcpUseServer } from './register.js';
import { resolveRepoRoot } from './context.js';
import type { PremortemMcpRuntimeEnv } from './types.js';

function parseOrigins(raw: string | undefined) {
  return (raw ?? '')
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean);
}

function buildOAuthConfig() {
  const supabaseUrl =
    process.env.MCP_USE_OAUTH_SUPABASE_URL?.trim() ||
    process.env.SUPABASE_URL?.trim() ||
    process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const projectId = process.env.MCP_USE_OAUTH_SUPABASE_PROJECT_ID?.trim();
  const jwtSecret =
    process.env.MCP_USE_OAUTH_SUPABASE_JWT_SECRET?.trim() ||
    process.env.SUPABASE_JWT_SECRET?.trim();

  if (!supabaseUrl && !projectId) {
    throw new Error('MCP Supabase OAuth requires MCP_USE_OAUTH_SUPABASE_URL or MCP_USE_OAUTH_SUPABASE_PROJECT_ID.');
  }

  return oauthSupabaseProvider({
    supabaseUrl,
    projectId,
    jwtSecret: jwtSecret || undefined,
    verifyJwt:
      process.env.MCP_USE_OAUTH_VERIFY_JWT
        ? ['1', 'true', 'yes'].includes(process.env.MCP_USE_OAUTH_VERIFY_JWT.toLowerCase())
        : Boolean(jwtSecret),
    scopesSupported: ['workspace:read', 'projects:read', 'audits:read', 'audits:write', 'billing:read', 'workspace:write']
  });
}

export function createPremortemMcpServer(env: PremortemMcpRuntimeEnv = {}) {
  const baseUrl =
    process.env.MCP_BASE_URL?.trim() ||
    'https://premortem.jstn.site/mcp';

  const server = new MCPServer({
    name: 'premortem-mcp',
    version: '0.1.0',
    oauth: buildOAuthConfig(),
    publicLandingPage: true,
    baseUrl,
    allowedOrigins: parseOrigins(process.env.MCP_ALLOWED_ORIGINS || process.env.NEXT_PUBLIC_APP_URL || 'https://premortem.jstn.site')
  });

  server.app.get('/healthz', (c) => {
    return c.json({
      ok: true,
      service: 'premortem-mcp',
      baseUrl,
      repoRoot: resolveRepoRoot(),
      auth: 'supabase-oauth'
    });
  });

  server.app.get('/', (c) => {
    return c.text('Premortem MCP server is running.');
  });

  registerPremortemToolsOnMcpUseServer(server, env);

  return server;
}

export async function startPremortemMcpServer(env: PremortemMcpRuntimeEnv = {}) {
  const server = createPremortemMcpServer(env);
  const port = Number.parseInt(process.env.PORT ?? process.env.MCP_PORT ?? '8787', 10);
  await server.listen(port);
  return server;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  await startPremortemMcpServer({
    PREMORTEM_REPO_ROOT: process.env.PREMORTEM_REPO_ROOT ?? process.cwd()
  });
}
