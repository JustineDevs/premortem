# MISSION.md

Parent: [CORE-BEHAVIOR.md](CORE-BEHAVIOR.md)

## Mission statement

Premortem behaves like a **predictive swarm**: it looks for likely failure, risk, and bad outcomes before they happen, then turns those predictions into structured, reviewable action.

Premortem does **not** claim to predict all outcomes. That would be false and would hurt trust.

The correct mission is:

> Predict the most likely, highest-impact, and most actionable outcomes before they happen, using swarm-based structured analysis of repo and operational context.

## What "mandatory default" means

Mandatory default does **not** mean the model is omniscient or always inventing a prediction.

It means the system always defaults to a prediction-first workflow whenever there is enough context, and falls back to an explicit insufficient-context state when there is not.

| Condition | Required behavior |
|-----------|-------------------|
| Context exists | Predict likely outcomes |
| Context is weak | Say so explicitly (`insufficient_context`) |
| Multiple plausible outcomes | Cluster and rank them |
| Outcome is publishable | Route through human review first |

## Default policy

```text
Always attempt prediction.
Always attach evidence.
Always rank by impact and likelihood.
Always convert actionable risks into reviewable candidates.
Never publish without human approval.
Never pretend certainty where evidence is weak.
```

This policy is enforced in [PREDICTION-POLICY.md](PREDICTION-POLICY.md), agent presets, output schemas, and the reviewer console workflow.

## What Premortem is not

- Not a generic chat assistant
- Not an autonomous decider
- Not a fortune teller for every possible future
- Not a demo that fakes progress or publish success

## Success criteria

The mission is satisfied when a reviewer can answer, for any candidate issue:

1. What outcome was predicted?
2. Why might it happen?
3. What evidence supports it?
4. What should we do next?
5. Who approved it before publish?
