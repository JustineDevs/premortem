# Session design

## Boundaries
- Browser uses Supabase session tokens.
- Cloudflare Workers use scoped service tokens.
- Provider actions use provider tokens stored through secret references.
- Dashboard never receives raw provider secrets.

## Goals
- Separation between user session, service authority, and provider authority.
- Minimal scope per token.
- Rotation and revocation without redeploying app code.
