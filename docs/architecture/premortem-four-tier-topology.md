# Premortem four-tier topology

Friendly overview of the major system components and data flow.

## Rendered image

![Premortem four-tier architecture](./premortem-four-tier-topology.png)

## 1. Entry Point

- Browser / end users
- Slack workspace
- External AI agents

## 2. Edge and Load Balancing

- Vercel frontend
- Next.js BFF routes
- Auth guard
- Rate limit guard

## 3. Public and Private Subnets

### Public subnet

- Web app shell
- Auth callback and login pages
- Workspace settings and reviewer console

### Private subnet

- API and orchestrator backend on Alibaba Cloud ECS
- Kubernetes packaging for the same backend runtime
- Audit pipeline
- MCP endpoints
- Slack events and webhooks
- Queue-backed async jobs

## 4. Data Layer

- Supabase Auth
- Supabase Postgres
- Supabase Storage
- Neo4j graph store
- Stripe billing and invoices
- GitLab source and issue sync
- Qwen Cloud and other LLM providers

## Hand-drawn sketch

```text
┌──────────────────────────────────────────────────────────────────────────────────────────────┐
│ 1. Entry Point                                                                               │
│                                                                                              │
│  Browser / End Users     Slack Workspace     External AI Agents                               │
└──────────────────────────────────────────────────────────────────────────────────────────────┘
                                       │
                                       ▼
┌──────────────────────────────────────────────────────────────────────────────────────────────┐
│ 2. Edge & Load Balancing                                                                     │
│                                                                                              │
│  Vercel Frontend        Next.js BFF Routes        Auth Guard        Rate Limit Guard         │
└──────────────────────────────────────────────────────────────────────────────────────────────┘
                                       │
                                       ▼
┌──────────────────────────────────────────────────────────────────────────────────────────────┐
│ 3. Public & Private Subnets (VPC boundary)                                                  │
│                                                                                              │
│  Public Subnet:                                                                            │
│   - app shell                                                                               │
│   - auth pages                                                                              │
│   - settings and review console                                                             │
│                                                                                              │
│  Private Subnet:                                                                            │
│   - Alibaba Cloud ECS backend                                                               │
│   - Kubernetes-packaged backend workloads                                                   │
│   - API + orchestrator                                                                      │
│   - audit pipeline                                                                          │
│   - MCP and Slack handlers                                                                  │
└──────────────────────────────────────────────────────────────────────────────────────────────┘
                                       │
                                       ▼
┌──────────────────────────────────────────────────────────────────────────────────────────────┐
│ 4. Data Layer                                                                                │
│                                                                                              │
│  Supabase Auth    Supabase Postgres    Supabase Storage    Neo4j    Stripe    GitLab    LLMs  │
└──────────────────────────────────────────────────────────────────────────────────────────────┘
```

## Renderable flowchart

```mermaid
flowchart LR
  subgraph T1[1. Entry Point]
    B[Browser / End Users]
    SL[Slack Workspace]
    AI[External AI Agents]
  end

  subgraph T2[2. Edge & Load Balancing]
    V[Vercel Frontend]
    BFF[Next.js BFF Routes]
    AG[Auth Guard]
    RL[Rate Limit Guard]
  end

  subgraph VPC[3. Public & Private Subnets]
    subgraph PUB[Public Subnet]
      WEB[Web App Shell]
      AUTH[Auth Callback + Login Pages]
      OS[Workspace Settings + Review Console]
    end

    subgraph PRIV[Private Subnet]
      API[Alibaba Cloud ECS API]
      K8S[Kubernetes backend package]
      ORCH[Orchestrator + Audit Pipeline]
      MCP[MCP Endpoints]
      WH[Slack Events + Webhooks]
      QJ[Queue-backed Async Jobs]
    end
  end

  subgraph T4[4. Data Layer]
    SU[Supabase Auth]
    PG[Supabase Postgres]
    ST[Supabase Storage]
    N4[Neo4j Graph Store]
    STP[Stripe Billing + Invoices]
    GL[GitLab Source + Issue Sync]
    QW[Qwen Cloud + LLM Providers]
  end

  B --> V
  SL --> V
  AI --> V
  V --> BFF --> AG
  AG --> RL
  RL --> WEB
  RL --> AUTH
  RL --> OS
  RL --> API
  API --> K8S
  API --> ORCH
  ORCH --> MCP
  ORCH --> WH
  ORCH --> QJ
  ORCH --> SU
  ORCH --> PG
  ORCH --> ST
  ORCH --> N4
  ORCH --> STP
  ORCH --> GL
  ORCH --> QW
```

## Legend

- Solid arrows: direct request or API flow
- Grouped boxes: environment or trust boundary
- Public subnet: externally reachable surfaces
- Private subnet: backend runtime and orchestration

## Reference proof links

- Alibaba Cloud deployment helper: [scripts/deploy/alibaba-cloud-ecs.ts](https://gitlab.com/gitlab-ai-hackathon/transcend/38920582/-/blob/main/scripts/deploy/alibaba-cloud-ecs.ts)
- Deployment metadata checker: [scripts/smoke/verify-env-utilization.ts](https://gitlab.com/gitlab-ai-hackathon/transcend/38920582/-/blob/main/scripts/smoke/verify-env-utilization.ts)
