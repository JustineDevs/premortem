---
name: obsidian-vault-context
description: Repo-local bridge for Premortem's Obsidian vault context. Use when the task benefits from reading or updating the external vault notes that mirror product doctrine, architecture decisions, system flow, and project memory.
---

# Obsidian Vault Context

## Purpose

Use this skill when Cursor needs project context from the external Obsidian vault.

This repository has a mounted vault bridge at:

- `.cursor/obsidian-vault`

That mount points to:

- `/home/justine/Documents/vault`

## Premortem note entrypoints

Read these first for Premortem-specific context:

1. `.cursor/obsidian-vault/Premortem/Premortem Index.md`
2. `.cursor/obsidian-vault/Premortem/Premortem Full Project Context - 2026-06-10.md`
3. `.cursor/obsidian-vault/Premortem/Premortem Systems Decision and Flow - 2026-06-10.md`
4. `.cursor/obsidian-vault/Premortem/Premortem ADR 0001 - Full Product and System Design Contract.md`

Then use companion notes as needed:

- `.cursor/obsidian-vault/Technology/Supabase.md`
- `.cursor/obsidian-vault/Technology/Prisma.md`
- `.cursor/obsidian-vault/Technology/GitLab.md`
- `.cursor/obsidian-vault/Premortem/Cloudflare Workers.md`

## Rules

- Treat Obsidian notes as `vault_context`, not build evidence.
- Repo files remain canonical for implementation truth.
- Use vault notes for doctrine, history, mapped decisions, and project memory.
- When repo truth and vault notes diverge, prefer the repo and update the vault deliberately.

## Obsidian plugin status

The upstream Meta-Architect Obsidian plugin is installed in the vault at:

- `/home/justine/Documents/vault/.obsidian/plugins/meta-architect`

This gives the vault a note-side bridge for:

- active note capture
- request queue handling
- context preview

## Output

When using this skill, summarize:

- which vault notes were used
- whether they were context only or required updating
- any repo-vs-vault drift that should be corrected
