# Cloud deployment topology

This page is a short pointer to the canonical deployment story:

- `docs/architecture/premortem-four-tier-topology.md` for the full four-tier diagram
- `docs/architecture/kubernetes-runtime.md` for the Kubernetes and Docker packaging contract
- `docs/releases/DEPLOY-PRODUCTION.md` for the current production deployment split

Current runtime split:

- Vercel hosts the frontend and web BFF.
- Alibaba Cloud ECS hosts the production backend today with runner-built images, runtime-only container startup, and health-gated rollback.
- Kubernetes manifests package the same backend runtime for cluster-backed deployment and portability.
- Supabase provides auth, Postgres, and storage.
- Neo4j stores graph snapshots and audit topology.
- LLM routing is handled in the backend through the provider registry.
