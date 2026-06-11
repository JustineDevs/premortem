# /vault-context
# Purpose: Load Premortem's Obsidian vault context from the repo-visible vault mount.

- LOAD: `.cursor/skills/obsidian-vault-context/SKILL.md`
- MOUNT:
  - `.cursor/obsidian-vault` -> `/home/justine/Documents/vault`
- FIRST READ:
  1. `.cursor/obsidian-vault/Premortem/Premortem Index.md`
  2. `.cursor/obsidian-vault/Premortem/Premortem Full Project Context - 2026-06-10.md`
  3. `.cursor/obsidian-vault/Premortem/Premortem Systems Decision and Flow - 2026-06-10.md`
  4. `.cursor/obsidian-vault/Premortem/Premortem ADR 0001 - Full Product and System Design Contract.md`
- RULES:
  1. Treat vault notes as context, not implementation evidence.
  2. Prefer repo truth if vault and repo diverge.
  3. Update the vault deliberately when architecture or doctrine changes.
