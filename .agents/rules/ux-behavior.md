# UX Behavior

Canonical domain: truthful interface, stable actions, visible scope.

Parent: [CORE-BEHAVIOR.md](CORE-BEHAVIOR.md) · [PREDICTION-POLICY.md](PREDICTION-POLICY.md)

## Tell the truth

| State | UI must show |
|-------|--------------|
| Ingesting | Ingesting |
| Clustering | Clustering |
| Idle | Idle (no fake spinner) |

Runtime console: `apps/web/src/components/premortem-os/audit-runtime-console.tsx`

## Prediction-first entry

- Default path is run predictive audit (scoped repo/branch), not open-ended chat
- Primary actions: run audit, review candidates, publish after approval
- Ad-hoc sandbox remains secondary; it must not replace the orchestrated prediction pipeline as the product default

## One meaning per action

| Action | Meaning |
|--------|---------|
| Run audit | Start an audit run for selected scope |
| Review | Inspect issue candidates before publish |
| Publish | Create external issue (GitLab) |
| Approve / Confirm | Reviewer accepts candidate |
| Stop all | Cancel active runs and disable continuous rotation |
| Resume | Continue a paused checkpointed run |

Do not overload terms for marketing.

## Show scope before action

- Before run: show repo, branch, and bounded scope
- Before publish: show exact title/body/target

## Design systems

| Surface | System |
|---------|--------|
| `/app` reviewer console | OS tokens, `premortem-os.css`, `design-system/premortem/MASTER.md` |
| Marketing / auth / docs | `landing.css`, marketing blocks |

Use `ui-ux-pro-max` skill for OS and marketing UX work.

## Accessibility and copy

- No em dashes in application UI strings
- Prefer native components over iframe embeds
- Real runtime data in `/app`; deprecated in-memory `store.ts` paths are not production targets

## Risk cluster navigation

Dashboard cluster “Open” must navigate to real audit findings with severity filter applied (`handleOpenRiskCluster` in `premortem-os-app.tsx`).
