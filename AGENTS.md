## Learned User Preferences

- Prefer native modular Next.js components over Framer/Unframer iframe embeds when rebuilding marketing or landing UI.
- Use existing assets under `public/` (especially `apps/web/public/logo/`) when implementing designs rather than sourcing new assets.
- Verify MCP server connectivity with `scripts/mcp/verify-all.mjs` when working with the project's MCP configuration.
- Compare landing implementations against `.internal/UI/Landing-page.png` for design fidelity verification.
- Landing UI uses custom extracted CSS, not Tailwind/shadcn, for marketing and auth surfaces. Build with landing-native components and `landing.css`. shadcn/ui is installed under `src/components/ui/` for optional future use but auth routes use landing tokens.

## Learned Workspace Facts

- pnpm monorepo (`pnpm@9.12.0`) with Turbo; primary web app at `apps/web`, local dev via `pnpm run dev`.
- Marketing landing page is composed from modular components in `apps/web/src/components/landing/`; `app/page.tsx` renders `LandingPage` directly.
- Landing page has no Framer/Unframer dependencies; styles live in `landing.css` with viewport scaling via `landing-scale.tsx` and mobile reflow in `landing-responsive.css`.
- Official landing design reference and visual diff artifacts live under `.internal/UI/` (e.g. `Landing-page.png`).
- Raster landing mockup assets are in `apps/web/public/landing/`; brand SVGs remain under `apps/web/public/logo/`.
- Marketing routes (`/products`, `/solutions`, `/how-it-works`, `/privacy`, `/terms`, `/docs`, `/signup`, `/login` and subpages) share `marketing-page-layout.tsx` or `blocks/marketing-doc-layout.tsx`; copy lives in `src/content/marketing/`; reusable blocks in `src/components/landing/blocks/`; URLs in `src/lib/marketing-links.ts` and `src/lib/auth-links.ts`.
- Premortem reviewer console lives at `/app` under route group `app/(os)/`; legacy `/reviews` redirects to `/app`. UI in `src/components/premortem-os/`; branding in `src/lib/premortem-os/branding.ts` (product name Premortem, domain premortem.dev); seed data and in-memory store in `src/lib/premortem-os/`; API routes at `app/api/projects` and `app/api/audits/**`. Uses Tailwind + Inter/Space Grotesk/JetBrains Mono (not landing.css).
- Legacy Framer export at `apps/web/src/vendor/premortem-landing/` is reference-only (excluded from `tsconfig.json` via `src/vendor/**`).
- MCP server definitions live in repo-root `mcp.local.json` (fallback `mcp.json`); Cursor does not automatically load this file. Verify with `scripts/mcp/verify-all.mjs`.
- `pnpm run build` may fail on pre-existing dashboard type errors around `AuditRunSnapshot` in `@premortem/orchestrator`, independent of landing-page changes.
- Toolbox Postgres MCP runs via `scripts/mcp/run-toolbox-postgres.sh` and requires `DATABASE_URL` in `.env.local`.
- Official GitLab MCP at `gitlab.com/api/v4/mcp` uses OAuth in Cursor; static PAT in env is not the supported auth path.
- Cloudflare Docs and Cloudflare Agents Docs MCP servers work without auth; other Cloudflare MCP servers need OAuth or `CLOUDFLARE_API_TOKEN`.
