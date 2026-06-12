# Arize Phoenix track alignment

Premortem is built for the [Google Cloud Rapid Agent Hackathon Arize track](https://rapid-agent.devpost.com/details/arize-resources): a **code-owned** Gemini agent runtime with **OpenInference tracing**, **Phoenix MCP self-introspection**, and **code + LLM evaluations** on audit missions.

Reference starter: [Arize-ai/gemini-hackathon](https://github.com/Arize-ai/gemini-hackathon).

## Architecture

| Layer | Implementation |
| --- | --- |
| Agent runtime | `@google/adk` root agent in `@premortem/agent-builder` (`premortem_predictive_audit_agent`) |
| Production pipeline | `@premortem/orchestrator` specialist swarm + human review gate |
| OpenInference tracing | `@arizeai/phoenix-otel` via `@premortem/observability` |
| Runtime MCP introspection | `@arizeai/phoenix-mcp` wired into the ADK agent as `phoenix_*` tools |
| Dev MCP (Cursor) | `Phoenix` + `Phoenix Docs` in repo-root `mcp.json` |
| Code evals | `evaluateAuditMissionQuality()` + Phoenix UI TypeScript evaluator |
| LLM-as-judge evals | `evaluateAuditMissionWithLlmJudge()` when `PHOENIX_LLM_EVAL=1` |
| Phoenix datasets SDK | `@arizeai/phoenix-client/datasets` via `appendAuditMissionToPhoenixDataset()` |
| Phoenix prompts SDK | `@arizeai/phoenix-client/prompts` via `ensurePremortemAuditJudgePrompt()` |

## Environment

Copy from `.env.example`:

```bash
PHOENIX_PROJECT_NAME=premortem
PHOENIX_COLLECTOR_ENDPOINT=https://app.phoenix.arize.com/s/your-space
PHOENIX_MCP_BASE_URL=https://app.phoenix.arize.com/s/your-space
PHOENIX_API_KEY=px_live_...
PHOENIX_LLM_EVAL=1   # optional: Gemini judge after audits
PHOENIX_SYNC_DATASETS=1   # optional: append completed audits to Phoenix dataset
PHOENIX_SYNC_PROMPTS=1    # optional: used by phoenix:bootstrap for prompt registration
GEMINI_API_KEY=...
```

Bootstrap datasets, prompts, and verify the TypeScript code evaluator locally:

```bash
pnpm run phoenix:bootstrap
pnpm run phoenix:bootstrap -- --dry-run   # local evaluator check only
```

Paste `packages/observability/phoenix-evaluators/premortem-audit-mission.eval.ts` into Phoenix **Evaluators → Create code evaluator** (TypeScript / Deno sandbox). See [Code Evaluators](https://arize.com/docs/phoenix/evaluation/server-evals/code-evaluators#typescript).

Phoenix Cloud free tier: [Phoenix Cloud](https://phoenix.arize.com/).

## Verify locally

```bash
pnpm run smoke:arize          # alias for smoke:hackathon
node scripts/mcp/verify-all.mjs
```

With `PHOENIX_API_KEY` set, traces export to your Phoenix project and Cursor can call Phoenix MCP tools (traces, prompts, datasets, experiments).

## Self-improvement loop

1. **Trace** — Gemini calls and agent missions emit OpenInference spans (`packages/llm`, `@premortem/agent-builder`, orchestrator).
2. **Inspect** — The ADK agent exposes Phoenix MCP tools at runtime; Cursor uses the same MCP via `scripts/mcp/run-phoenix-mcp.sh`.
3. **Evaluate** — Code checks run on every completed audit; optional LLM judge scores mission quality.
4. **Iterate** — Use Phoenix UI or MCP to review traces, attach [LLM evals](https://arize.com/docs/phoenix/evaluation/llm-evals), and tune prompts.

## Key paths

- `packages/observability/src/phoenix.ts` — tracing + evaluators
- `packages/observability/src/phoenix-datasets.ts` — `@arizeai/phoenix-client/datasets`
- `packages/observability/src/phoenix-prompts.ts` — `@arizeai/phoenix-client/prompts`
- `packages/observability/src/phoenix-code-evaluator.ts` — shared code eval logic
- `packages/observability/phoenix-evaluators/premortem-audit-mission.eval.ts` — Phoenix UI evaluator source
- `scripts/phoenix/bootstrap-platform.mjs` — register dataset + prompt in Phoenix
- `services/agent-builder/src/phoenix-mcp.ts` — runtime Phoenix MCP connection
- `services/agent-builder/src/index.ts` — ADK agent with GitLab + Phoenix MCP toolsets
- `scripts/mcp/run-phoenix-mcp.sh` — Cursor MCP launcher
- `scripts/smoke/verify-hackathon-readiness.mjs` — hackathon gate

## Further reading

- [Phoenix documentation](https://arize.com/docs/phoenix)
- [Phoenix MCP server](https://arize.com/docs/phoenix/integrations/phoenix-mcp-server)
- [OpenInference](https://github.com/Arize-ai/openinference)
