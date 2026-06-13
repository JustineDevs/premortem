# Premortem ecosystem

## Core stack
- Supabase / Postgres for product data, auth-adjacent app storage, and RLS-oriented multi-tenant ownership.
- Prisma for application data access and typed repositories.
- Cloudflare Workers via Wrangler for API edge entrypoints.
- GitLab as the primary issue publishing and repository provider.
- MCP Toolbox for Databases as the official MCP server for database introspection and safe SQL-oriented agent access.
- Gemini as the default LLM path, with Azure OpenAI as the Microsoft-backed enterprise alternative.
- Gemini Enterprise Agent Platform / Vertex AI as the managed deployment option for the optional `services/agent-builder` runtime.
- Neo4j as the graph persistence and traversal layer for repository structure and risk context.

## Supporting services to add next
- Cloudflare Queues for async audit fan-out.
- Cloudflare R2 for graph snapshot exports and evidence bundles.
- Cloud Run or Agent Platform deployment for the optional ADK runtime package.
- Upstash Redis or Valkey for idempotency and short-lived orchestration state.
- Temporal or Trigger.dev if audits become long-running workflows.
- OpenTelemetry + Grafana/Tempo/Loki for traces, logs, and metrics.
- Microsoft Entra ID if enterprise SSO becomes required.
- MCP Toolbox prebuilt Postgres server configuration if the project needs a local MCP database bridge outside the main app runtime.
