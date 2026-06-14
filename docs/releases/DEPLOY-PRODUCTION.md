# Production deployment (Cloudflare + Supabase)

Premortem v0.1.0 splits runtime across:

| Surface | Target | Route |
| --- | --- | --- |
| Web (Next.js BFF + marketing + `/app`) | Cloudflare Pages | `premortem.jstn.site` |
| API (audit orchestration) | Cloudflare Worker | `api.jstn.site` |
| Database + Auth | Supabase | Postgres pooler + Auth |
| Graph | Neo4j Aura or self-hosted | Bolt URI |
| Billing | Stripe | Checkout + webhooks |

## 1. GitHub → CI

Push to `main` (or `master`) runs `.github/workflows/ci.yml`:

```bash
pnpm install
pnpm lint
pnpm typecheck
pnpm build
```

## 2. API Worker deploy

After CI succeeds, `.github/workflows/deploy.yml` deploys `apps/api` when these GitHub secrets exist:

- `CLOUDFLARE_API_TOKEN` (Workers + Queues edit)
- `CLOUDFLARE_ACCOUNT_ID`

Manual deploy:

```bash
pnpm --filter @premortem/api build
cd apps/api && pnpm run deploy
```

Wrangler 4 requires Node.js 22 or newer for the deploy step.

Set Worker secrets in Cloudflare (not in git):

```bash
cd apps/api
npx wrangler secret put DATABASE_URL --env production
npx wrangler secret put DIRECT_URL --env production
npx wrangler secret put GEMINI_API_KEY --env production
npx wrangler secret put GITLAB_CLIENT_ID --env production
npx wrangler secret put GITLAB_CLIENT_SECRET --env production
npx wrangler secret put NEO4J_URI --env production
npx wrangler secret put NEO4J_PASSWORD --env production
npx wrangler secret put SUPABASE_SERVICE_ROLE_KEY --env production
```

Production queue bootstrap runs during deploy when `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID` are present. If you need to provision them manually, run:

```bash
cd apps/api
node ../../scripts/cloudflare/ensure-queues.mjs production
```

## 3. Web (Cloudflare Pages)

Connect the GitHub repo in **Workers & Pages → Create → Pages → Connect to Git**.

Recommended monorepo settings:

| Setting | Value |
| --- | --- |
| Production branch | `main` |
| Root directory | `/` (repo root) |
| Build command | `pnpm install --frozen-lockfile && pnpm run build:pages` |
| Build output | Use Cloudflare **Next.js** preset (dashboard auto-detect) or OpenNext adapter when added |

Pages environment variables (production):

- `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_URL`, `SUPABASE_ANON_KEY` as server-side fallbacks accepted by the web runtime
- `NEXT_PUBLIC_APP_URL` = `https://premortem.jstn.site`
- `PREMORTEM_API_BASE_URL` = `https://api.jstn.site`
- `DATABASE_URL`, `DIRECT_URL` (server routes / Prisma)
- `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`
- `STRIPE_PRICE_PRO`, `STRIPE_PRICE_TEAM`, `STRIPE_PRICE_PRO_ANNUAL`, `STRIPE_PRICE_TEAM_ANNUAL`
- `SENTRY_DSN`, `NEXT_PUBLIC_SENTRY_DSN`
- `NEXT_PUBLIC_POSTHOG_KEY`, `NEXT_PUBLIC_POSTHOG_HOST`
- Do **not** set `PREMORTEM_AUTH_DISABLED` in production

Stripe webhook endpoint: `https://premortem.jstn.site/api/webhooks/stripe`

## 4. Stripe (verified)

Test catalog in Stripe (account `acct_1S3ChjRvbSAmdYDO`):

- **Premortem Starter** → maps to `pro` plan prices
- **Premortem Growth** → maps to `team` plan prices

Ensure `.env.local` / Pages secrets use the active price IDs (`price_1Tgyw2…`, `price_1Tgyw3…`, etc.).

Test mode (`sk_test_…`): Checkout Sessions work; plan PATCH bypasses Stripe for local dev when `shouldUseStripeCheckout()` is false.

Live mode (`sk_live_…`): Checkout + webhooks drive entitlements.

## 5. Pre-flight smokes (run against production URL)

```bash
PREMORTEM_WEB_PORT=443 PREMORTEM_API_PORT=443 \
PREMORTEM_WEB_BASE=https://premortem.jstn.site \
PREMORTEM_API_BASE=https://api.jstn.site \
pnpm run smoke:production-readiness
```

Local before push:

```bash
pnpm run dev
pnpm run smoke:full-app-stress
pnpm run smoke:production-readiness   # with PREMORTEM_PRODUCTION_MODE=1
```

## 6. Tag release

```bash
git tag -a v0.1.0 -m "Premortem v0.1.0 — GitLab-first stranger self-serve"
git push origin v0.1.0
```

GitHub Release workflow publishes notes from `docs/releases/releases-notes-v0.1.0.md`.
