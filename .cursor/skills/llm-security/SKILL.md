---
name: llm-security
description: LLM and AI agent security testing for prompt injection, RAG poisoning, MCP injection, and guardrail evaluation. Authorization required.
---

# LLM Security (Premortem bridge)

Load the full skill from `.agents/skills/security/llm-security/SKILL.md` and follow it for the current task.

Pair with `.cursor/skills/vet` for trust-boundary review before implementation. Use `pnpm run eval:prompts` and promptfoo for regression; use llm-security workflows for authorized red-team passes.

Upstream: https://github.com/hardw00t/ai-security-arsenal (llm-security skill)
