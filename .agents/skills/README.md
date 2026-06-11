# Project-Local Skills

This directory holds the project-local skill pack for Premortem.

Only upstream, vendor-authored skill packs stay here. No custom-generated placeholder skills are kept in this tree.

## Categories

| Category | Path | Upstream / notes |
|----------|------|------------------|
| Behavior | [[behavior/README\|behavior/]] | stop-slop, humanizer |
| Engineering | [[engineering/README\|engineering/]] | mattpocock/skills |
| Security | [[security/README\|security/]] | hardw00t/ai-security-arsenal |
| LLM ops | [[llm-ops/README\|llm-ops/]] | promptfoo, langfuse, invariant |
| Reference | [[reference/README\|reference/]] | awesome-ai-software-engineering |
| Cloudflare | [[cloudflare/README\|cloudflare/]] | Cloudflare platform |
| Google Cloud | [[google-cloud/README\|google-cloud/]] | GCP / Gemini |
| GitLab | [[gitlab/README\|gitlab/]] | GitLab workflow |
| Frontend | [[frontend/README\|frontend/]] | Next.js, React |
| Data | [[data/README\|data/]] | Supabase, Postgres |

## Cursor bridges

Workflow skills under `.cursor/skills/` (align, vet, cleanup, maestro, etc.) remain the gated Codex lanes. Category skills above are loaded for domain work; thin bridges exist at:

- `.cursor/skills/stop-slop`, `humanizer`, `llm-security`, `promptfoo`, `langfuse`

## Notes

- Core Codex workflow skills remain in the Codex runtime and are not mirrored into the project tree.
- Add new packs by copying the upstream vendor skill directory into the matching category folder, then document provenance in the category README.
- Prompt eval gate: `pnpm run eval:prompts` (`packages/evals/promptfoo/`).
