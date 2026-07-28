# Production deployment (Vercel + Alibaba Cloud ECS + Supabase + Kubernetes packaging)

Premortem v0.1.0 splits runtime across:

| Surface | Target | Route |
| --- | --- | --- |
| Web (Next.js BFF + marketing + `/app`) | Vercel | `premortem.jstn.site` |
| API (audit orchestration) | Alibaba Cloud ECS | `api.jstn.site` |
| Database + Auth | Supabase | Postgres pooler + Auth |
| Graph | Neo4j Aura or self-hosted | Bolt URI |
| Billing | Stripe | Checkout + webhooks |
| Portable backend packaging | Kubernetes manifests | `deploy/kubernetes/base` |

## 1. GitHub → CI

Push to `main` (or `master`) runs `.github/workflows/ci.yml`:

```bash
pnpm install
pnpm lint
pnpm typecheck
pnpm build
```

## 2. API backend deploy

After CI succeeds, `.github/workflows/deploy.yml` deploys `apps/api` on Alibaba Cloud ECS when the backend environment and deployment target are configured.
The runner builds the Docker image, transfers the image archive to ECS, and ECS only loads and runs the prebuilt container. The host never performs a Docker build. The reusable deploy script lives at `scripts/deploy/alibaba-cloud-ecs-runtime.sh`.

Manual deploy:

```bash
export ECS_PORT=22
export ECS_USER=root
export ECS_HOST=your-ecs-host
export ECS_APP_DIR=/root/workspace/premortem
export ECS_DEPLOY_REF="$(git rev-parse HEAD)"

bash scripts/deploy/alibaba-cloud-ecs-runtime.sh
```

The deployment helper prints the ECS instance metadata when it can reach the Alibaba Cloud metadata service and falls back to the configured host or public URL when metadata is unavailable. It also keeps the previous ECS container around until the new one passes health, then removes the backup.
The ECS runtime helper now also starts an explicit Caddy edge proxy on ports 80 and 443 when `ECS_PUBLIC_URL` is set, so `api.jstn.site` can terminate TLS on the ECS host and forward to the local API container on `127.0.0.1:18787`.
If the public URL still times out after a deploy, the remaining causes are outside the container runtime itself: security-group rules, host firewall rules, or DNS not pointing at the ECS public IP.
Runtime secrets are written on the ECS host to `/etc/premortem/premortem-api.env` with `0700` parent directory permissions and `0600` file permissions. The app checkout never stores the runtime env file inside the repo tree.

Set backend secrets in the ECS runtime environment or deployment system, not in git:

- `DATABASE_URL`
- `DIRECT_URL`
- `GEMINI_API_KEY`
- `GITLAB_CLIENT_ID`
- `GITLAB_CLIENT_SECRET`
- `NEO4J_URI`
- `NEO4J_PASSWORD`
- `SUPABASE_SERVICE_ROLE_KEY`

The same API runtime is packaged for Kubernetes in `deploy/kubernetes/base`. That package uses the production Dockerfiles in `apps/api/Dockerfile` and `services/agent-builder/Dockerfile`, so ECS and Kubernetes share the same container build contract.

## 3. Web (Vercel)

Connect the GitHub repo in Vercel.

Recommended monorepo settings:

| Setting | Value |
| --- | --- |
| Production branch | `main` |
| Root directory | `/` (repo root) |
| Build command | `pnpm install --frozen-lockfile && pnpm run build:pages` |
| Build output | Next.js build output detected by Vercel |

The `pnpm run build:pages` wrapper loads repo-root `.env.production` before the Vercel build starts.

Frontend environment variables (production):

- `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_URL`, `SUPABASE_ANON_KEY` as server-side fallbacks accepted by the web runtime
- `NEXT_PUBLIC_APP_URL` = `https://premortem.jstn.site`
- `PREMORTEM_SITE_URL` = `https://premortem.jstn.site`
- `PREMORTEM_API_BASE_URL` = `https://api.jstn.site`
- `DATABASE_URL`, `DIRECT_URL` (server routes / Prisma)
- `AUTH_JWT_SECRET`, `IDENTITY_HMAC_SECRET`
- BotID runs automatically in production on Vercel and does not require a secret key
- `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`
- `STRIPE_PRICE_PRO`, `STRIPE_PRICE_TEAM`, `STRIPE_PRICE_SCALE`, `STRIPE_PRICE_PRO_ANNUAL`, `STRIPE_PRICE_TEAM_ANNUAL`, `STRIPE_PRICE_SCALE_ANNUAL`
- `STRIPE_PAYMENT_LINK_PRO_MONTHLY`, `STRIPE_PAYMENT_LINK_PRO_ANNUAL`, `STRIPE_PAYMENT_LINK_TEAM_MONTHLY`, `STRIPE_PAYMENT_LINK_TEAM_ANNUAL`, `STRIPE_PAYMENT_LINK_SCALE_MONTHLY`, `STRIPE_PAYMENT_LINK_SCALE_ANNUAL`
- `GITLAB_CLIENT_ID`, `GITLAB_CLIENT_SECRET`, `GITLAB_TOKEN`, `GITLAB_WEBHOOK_SECRET`
- `GITHUB_CLIENT_ID`, `GITHUB_SECRET`, `GITHUB_TOKEN`
- `SLACK_APP_ID`, `SLACK_CLIENT_ID`, `SLACK_CLIENT_SECRET`, `SLACK_SIGNING_SECRET`, `SLACK_VERIFICATION_TOKEN`, `SLACK_SCOPE_TOKEN`, `SLACK_SANDBOX`
- `NANGO_BASE_URL`, `NANGO_SECRET_KEY`, `NANGO_WEBHOOK_SIGNING_KEY`
- `OPENROUTER_API_KEY`, `GEMINI_API_KEY`, `QWEN_API_KEY`
- `LANGFUSE_PUBLIC_KEY`, `LANGFUSE_SECRET_KEY`, `LANGFUSE_BASE_URL`
- `SENTRY_DSN`, `NEXT_PUBLIC_SENTRY_DSN`
- `NEXT_PUBLIC_POSTHOG_KEY`, `NEXT_PUBLIC_POSTHOG_HOST`
- Do **not** set `PREMORTEM_AUTH_DISABLED` in production

Stripe webhook endpoint: `https://premortem.jstn.site/api/webhooks/stripe`

Preview environment on Vercel:

- Vercel automatically provides `VERCEL_ENV=preview` and `VERCEL_URL` for preview deployments.
- Set preview-scoped environment variables in Vercel so preview deployments do not read production backend URLs or production-only secrets.
- Recommended preview variables: `PREMORTEM_API_BASE_URL`, `NEXT_PUBLIC_APP_URL`, `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `LANGFUSE_PUBLIC_KEY`, `LANGFUSE_SECRET_KEY`, `LANGFUSE_BASE_URL`, `SENTRY_DSN`, `NEXT_PUBLIC_SENTRY_DSN`, `NEXT_PUBLIC_POSTHOG_KEY`, `NEXT_PUBLIC_POSTHOG_HOST`.
- If `PREMORTEM_API_BASE_URL` is missing in preview, the web runtime now fails loudly instead of silently falling back to production.

## 3.5 Kubernetes package

The checked-in Kubernetes manifests are the portable backend deployment path.

```bash
kubectl apply -k deploy/kubernetes/base
```

The manifests include:

- namespace and service account
- API Deployment, Service, PDB, and HPA
- agent-builder Deployment, Service, and PDB
- default-deny network policies with explicit egress rules
- ingress for `api.jstn.site`

This package is intended for cluster-backed backend deployments and local cluster validation. The frontend stays on Vercel.

### 3.6 Helm package

The same backend package is also available as a production-ready Helm chart in `deploy/helm/premortem`.

```bash
helm template premortem deploy/helm/premortem
```

Use the chart when you need values-driven overrides for:

- ingress host and TLS wiring
- replica counts and rolling update settings
- resource quotas and limit ranges
- optional secret creation for local or bootstrap installs

By default, the chart expects an existing Kubernetes Secret named `premortem-runtime-secrets` so cluster operators can keep production credentials outside the chart release.

## 4. Stripe (verified)

Test catalog in Stripe (account `acct_1S3ChjRvbSAmdYDO`):

- **Premortem Starter** → maps to `pro` plan prices
- **Premortem Growth** → maps to `team` plan prices
- **Premortem Scale** → maps to `scale` plan prices

Ensure `.env.local` / Vercel secrets use the active price IDs (`price_1Tgyw2…`, `price_1Tgyw3…`, etc.).

Test mode (`sk_test_…`): Checkout Sessions work when the catalog and webhook secrets are configured. The same checkout and portal flows are exercised in test mode, so local smoke catches real billing behavior.

Live mode (`sk_live_…`): Checkout + webhooks drive entitlements.

Customer Portal: the billing settings surface opens Stripe Billing Portal so users can manage payment methods, invoices, and cancellations without support intervention.

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
git tag -a v0.1.0 -m "Premortem v0.1.0 - GitLab-first stranger self-serve"
git push origin v0.1.0
```

GitHub Release workflow publishes notes from `docs/releases/releases-notes-v0.1.0.md`.
