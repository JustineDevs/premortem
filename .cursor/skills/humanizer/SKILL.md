---
name: humanizer
description: Remove signs of AI-generated writing from text. Use when editing user-facing Premortem copy before publish.
---

# Humanizer (Premortem bridge)

Load the full skill from `.agents/skills/behavior/humanizer/SKILL.md` and follow it for the current task.

The source of truth is `SKILL.md` in that directory (33 pattern checks). Do not paraphrase the pattern list from memory.

Use after `stop-slop` for a second pass on high-visibility copy (marketing, docs, release notes).

Upstream: https://github.com/blader/humanizer
