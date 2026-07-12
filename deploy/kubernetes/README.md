# Premortem Kubernetes runtime package

This directory packages the backend runtime for Kubernetes using the same containerized services that power the ECS deployment.

## What this package covers

- `premortem-api`: the public backend API and audit orchestration surface
- `premortem-agent-builder`: the agent runtime and model execution surface
- namespace, service account, config, probes, resource limits, quota guards, limit ranges, secret template, and network policy

The frontend remains on Vercel. The Kubernetes package is for the backend runtime, internal worker surfaces, and portability between ECS and cluster-based deployments.

## Build images

Use the production Dockerfiles:

```bash
docker build -f apps/api/Dockerfile -t premortem-api:prod .
docker build -f services/agent-builder/Dockerfile -t premortem-agent-builder:prod .
```

## Apply manifests

```bash
kubectl apply -k deploy/kubernetes/base
```

## Helm chart

The same runtime package is also available as a Helm chart:

```bash
helm template premortem deploy/helm/premortem
```

Use the chart when you want values-driven overrides for ingress, quotas, limits, and optional secret creation.

## Required secrets

Create the runtime secrets before applying the workload manifests:

```bash
kubectl create secret generic premortem-runtime-secrets \
  --namespace premortem \
  --from-literal=DATABASE_URL='replace-me' \
  --from-literal=DIRECT_URL='replace-me' \
  --from-literal=SUPABASE_SERVICE_ROLE_KEY='replace-me' \
  --from-literal=GEMINI_API_KEY='replace-me' \
  --from-literal=GITLAB_CLIENT_ID='replace-me' \
  --from-literal=GITLAB_CLIENT_SECRET='replace-me' \
  --from-literal=PHOENIX_API_KEY='replace-me' \
  --from-literal=PHOENIX_COLLECTOR_ENDPOINT='replace-me' \
  --from-literal=LANGFUSE_PUBLIC_KEY='replace-me' \
  --from-literal=LANGFUSE_SECRET_KEY='replace-me' \
  --from-literal=SENTRY_DSN='replace-me' \
  --from-literal=POSTHOG_API_KEY='replace-me' \
  --from-literal=STRIPE_SECRET_KEY='replace-me' \
  --from-literal=STRIPE_WEBHOOK_SECRET='replace-me'
```

If you manage secrets outside Kubernetes, bind the same keys into the namespace with your external secret manager and keep the names consistent.
