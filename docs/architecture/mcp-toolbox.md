# MCP Toolbox

MCP Toolbox for Databases is the official Google-maintained MCP server used in Premortem for database-facing agent work.

## Why it is here

Premortem already depends on a Postgres-backed data model through Supabase. The project needs a vendor-authored MCP server that can expose database-safe tools to MCP-compatible clients without inventing a custom local proxy. MCP Toolbox fits that role because it provides:

- a prebuilt `postgres` MCP server mode
- typed database-aware tools such as table discovery and SQL execution
- support for standard MCP clients including Codex
- a clear environment-variable contract for database connection settings

## Official source

- `https://github.com/googleapis/mcp-toolbox`

## Current project wiring

The project-local MCP config includes a shared template in `mcp.json` and an actual local wiring in `mcp.local.json`:

- server name: `Toolbox Postgres`
- command: `npx`
- package: `@toolbox-sdk/server`
- mode: `--prebuilt=postgres --stdio`

The matching template also lives in:

- `mcp-templates/mcp-toolbox.postgres.json`
- `mcp.local.json`

## Required environment variables

The current project template uses placeholders for the official PostgreSQL prebuilt configuration contract:

- `POSTGRES_HOST`
- `POSTGRES_PORT`
- `POSTGRES_DATABASE`
- `POSTGRES_USER`
- `POSTGRES_PASSWORD`

The committed template stays placeholder-based. The local project file `mcp.local.json` holds the actual database wiring for this workspace.

## What it is not

MCP Toolbox is not a custom agent skill and not a substitute for the project application code. It is a local MCP server that provides database access tooling to compatible clients. The application still owns:

- data model design
- migrations
- RLS and auth rules
- audit/history persistence
- domain-specific query shape

## Relevance to Premortem

The project uses Postgres for the core control plane and operational state. That makes Toolbox a practical local companion for:

- schema inspection
- SQL experimentation
- data-aware debugging
- database-oriented agent workflows
- controlled access to the database surface during development

## Verification

Verified on disk:

- `mcp.json` includes a `Toolbox Postgres` server entry
- `mcp.local.json` includes the actual local Supabase connection for the Toolbox server
- `mcp-templates/mcp-toolbox.postgres.json` exists
- `docs/architecture/ecosystem.md` references the Toolbox role in the stack
