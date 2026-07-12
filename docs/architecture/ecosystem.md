# Premortem ecosystem

## Core stack
- Supabase / Postgres for product data, auth-adjacent app storage, and RLS-oriented multi-tenant ownership.
- Prisma for application data access and typed repositories.
- Vercel for the frontend and BFF surface.
- Alibaba Cloud ECS for backend deployment and runtime hosting.
- GitLab as the primary issue publishing and repository provider.
- MCP Toolbox for Databases as the official MCP server for database introspection and safe SQL-oriented agent access.
- Qwen Cloud and Gemini as the default LLM paths for audits and agent flows.
- Gemini Enterprise Agent Platform / Vertex AI as the managed deployment option for the optional `services/agent-builder` runtime.
- Neo4j as the graph persistence and traversal layer for repository structure, risk context, and audit history.
- OpenTelemetry as the transport layer for application traces, metrics, and log correlation.
- Prometheus as the core metrics store and query layer.
- Grafana Loki as the log aggregation backend.
- Grafana Tempo as the distributed tracing backend.
- Grafana as the unified operational dashboard for metrics, logs, traces, and drill-down navigation.
- Devin AI for assistant-assisted workflow automation and review support.

## Supporting services to add next
- Alibaba Cloud ECS autoscaling and deployment helpers for backend runtime operations.
- Object storage for graph snapshot exports and evidence bundles.
- Cloud Run or Agent Platform deployment for the optional ADK runtime package.
- Upstash Redis or Valkey for idempotency and short-lived orchestration state.
- Temporal or Trigger.dev if audits become long-running workflows.
- Microsoft Entra ID if enterprise SSO becomes required.
- MCP Toolbox prebuilt Postgres server configuration if the project needs a local MCP database bridge outside the main app runtime.
