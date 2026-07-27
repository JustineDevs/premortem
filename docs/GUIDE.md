# Premortem guide

Premortem is a reviewer-first audit system. The fastest way to understand it is to run the real loop once, then inspect the findings, review surface, and deployment proof.

## Project overview

Premortem is built as a production workflow, not a demo:

- Vercel serves the frontend and reviewer console.
- Alibaba Cloud ECS hosts the backend runtime and orchestrator.
- Supabase provides auth, Postgres, and storage.
- GitLab MCP and GitLab APIs power repository ingest and issue publish.
- Qwen Cloud, Gemini, and OpenRouter provide model routing for audits and fallback execution.
- Slack handles notifications, commands, and workspace updates.
- Resend provides transactional email for auth and product flows.
- Phoenix, Langfuse, Sentry, and PostHog provide tracing, evaluation, error capture, and product telemetry.

## Testing instructions

Use these credentials or environment values when you want a real run instead of fixture mode:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `DATABASE_URL`
- `DIRECT_URL`
- `GITLAB_CLIENT_ID`
- `GITLAB_CLIENT_SECRET`
- `GITLAB_TOKEN` if you are using a personal access token for repo ingest and publish
- `GEMINI_API_KEY`, `OPENROUTER_API_KEY`, or `QWEN_API_KEY`
- `ALIBABA_CLOUD_ECS_HOST` or `ALIBABA_CLOUD_ECS_PUBLIC_URL` for backend deployment proof
- `SLACK_BOT_TOKEN`, `SLACK_SIGNING_SECRET`, and any Nango connection values required for Slack sync
- `RESEND_API_KEY` if you want email delivery to work end to end
- `STRIPE_SECRET_KEY` and `STRIPE_WEBHOOK_SECRET` if billing flows are part of the test
- `PHOENIX_API_KEY`, `NEXT_PUBLIC_POSTHOG_KEY`, and `SENTRY_DSN` if you want the observability path fully exercised

For local smoke work:

1. Copy `.env.example` to `.env.local`.
2. Fill the provider, auth, and database values.
3. Run `pnpm run dev`.
4. Open `/app`, start an audit, and verify the reviewer console updates from real runtime data.

If you do not have full credentials, the repo still supports fixture mode for smoke-only checks, but that is not the production path.

## AI tools leveraged

These are the AI and agent tools used or supported in this project:

- Codex CLI for code changes, verification, and repo maintenance.
- Qwen Cloud for compatible model routing and local-provider fallback testing.
- Alibaba Cloud ECS for backend deployment hosting and deployment proof.
- Slack for event delivery, notifications, and workspace command handling.
- Devin AI for assisted workflow automation and implementation review.
- Gemini for the primary audit and synthesis model path.
- OpenRouter for multi-provider model routing.
- Arize Phoenix for tracing and semantic graph review.
- Langfuse for prompt and evaluation workflows.
- Sentry and PostHog for error and product telemetry.
- promptfoo for prompt regression verification.

## Architecture diagram

```text
                          +----------------------+
                          |      Users / Judge   |
                          +----------+-----------+
                                     |
                                     v
                          +----------------------+
                          |   Vercel Frontend    |
                          |  Next.js / /app UI   |
                          +----------+-----------+
                                     |
                     BFF, auth, API requests, billing
                                     |
                                     v
                          +----------------------+
                          | Alibaba Cloud ECS    |
                          | Backend runtime      |
                          | API + orchestrator    |
                          +----+-----------+-----+
                               |           |
                GitLab / Stripe / Slack    | audit events
                               |           v
                               |    +------------------+
                               |    |  Supabase Postgres|
                               |    |  Auth + Storage   |
                               |    +------------------+
                               |
                               v
                       +------------------+
                       |    Neo4j graph   |
                       |  audit topology  |
                       +------------------+

LLM routes:
  Qwen Cloud  -> compatible model provider
  Gemini      -> primary audit model
  OpenRouter  -> fallback routing layer
  Slack       -> notification and command surface
  Resend      -> transactional email delivery

Workflow support:
  Devin AI -> review assistance and automation
```

## Proof of Alibaba Cloud deployment

Use this code file as the deployment proof reference:

- [scripts/deploy/alibaba-cloud-ecs.ts](https://github.com/JustineDevs/premortem/blob/main/scripts/deploy/alibaba-cloud-ecs.ts)

It is the backend deployment helper that resolves Alibaba Cloud ECS metadata and prints the runtime health target. The ECS host only loads and runs a prebuilt image archive; it does not build containers on the machine itself.

## Notes

- Vercel owns the frontend delivery path.
- Alibaba Cloud ECS owns the backend deployment path.
- Supabase remains the auth and database layer.
- Qwen Cloud, Gemini, and OpenRouter remain the model routing options.
- Slack is part of the product surface for notifications and command handling.
- Resend is used for branded transactional email flows.
- Phoenix, Langfuse, Sentry, and PostHog are treated as real integrations for tracing, evaluation, alerts, and analytics.
- This guide is intentionally practical. It is meant to help you run, test, and verify the system, not explain the brand story.
