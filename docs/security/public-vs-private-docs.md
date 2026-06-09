# Public vs private docs convention

## Public docs
Keep reusable architecture, onboarding, runbooks, release notes, and developer documentation in tracked `docs/` paths.

## Private docs
Keep sensitive system design, security assessments, customer notes, private go-to-market plans, review comments, submission drafts, and internal-only diagrams in ignored paths such as `/internal`, `/.internal`, or `/docs/internal`.

## Rule of thumb
If a file would be unsafe to expose in a public repository, partner handoff, or student submission archive, it belongs in an ignored private path.
