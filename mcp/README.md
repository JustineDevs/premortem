# Premortem MCP

Standalone MCP server for Premortem.

## Local development

```bash
pnpm --filter @premortem/mcp dev
```

## Production

- Serve the MCP endpoint over HTTPS at `https://premortem.jstn.site/mcp`
- Configure Supabase OAuth provider variables in the deployment environment
- Set `MCP_BASE_URL=https://premortem.jstn.site/mcp`
- Set `MCP_ALLOWED_ORIGINS=https://premortem.jstn.site`
- Set `MCP_USE_OAUTH_SUPABASE_URL` or `MCP_USE_OAUTH_SUPABASE_PROJECT_ID`
- Set `MCP_USE_OAUTH_SUPABASE_JWT_SECRET` when JWT verification is enabled
- Set `PREMORTEM_REPO_ROOT` if the service is started outside the monorepo root

## Tool surface

The service exposes org-scoped tools for:

- identity and effective roles
- workspace summary and billing state
- connected projects with cursor pagination
- recent audits and audit details
- audit submission for authorized users

All tool calls require a Supabase-authenticated user or a local fixture bypass in development only.
