# /meta-architect
# Purpose: Compatibility command for users who ask for Meta-Architect by product name.

- FORWARD TO: `/maestro`
- LOAD: `.cursor/skills/maestro/SKILL.md`
- NOTE:
  1. The official upstream package does not ship a separate in-session `meta-architect` skill.
  2. The official umbrella surface is `$maestro`.
  3. Use the installed lane skills under `.cursor/skills/` for the full packaged surface.
