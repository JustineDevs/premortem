# Session design

## Boundaries
- Browser uses Supabase session tokens for email/password, magic-link, and GitLab-connected sign-in flows.
- Deployment runtimes use scoped service tokens and environment-only secrets.
- Provider actions use provider tokens stored through secret references.
- Dashboard never receives raw provider secrets.

## Goals
- Separation between user session, service authority, and provider authority.
- Minimal scope per token.
- Rotation and revocation without redeploying app code.
- Role-aware reviewer access in `/app`, with member, admin, and owner sections mapped from the authenticated org membership.
