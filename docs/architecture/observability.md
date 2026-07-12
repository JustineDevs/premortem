# Observability

Premortem treats observability as a runtime contract, not an afterthought.

The stack is layered so each tool owns one signal type:

- OpenTelemetry captures and transports traces, spans, metrics, and log correlation context
- Prometheus stores and queries numeric metrics
- Grafana Loki aggregates and searches logs
- Grafana Tempo stores distributed traces
- Grafana renders the operational control plane
- Phoenix records LLM traces, prompts, datasets, and evaluators
- Langfuse handles managed prompts and quality scores
- Sentry captures exceptions and failure context
- PostHog captures product events and feature-usage behavior

## Signal flow

1. user or worker request enters the system
2. correlation ID is attached at the boundary
3. OpenTelemetry span context propagates across API, orchestrator, queue, and provider calls
4. traces land in Phoenix and Tempo
5. metrics are emitted to Prometheus
6. logs are written to Loki with the same request or audit identifiers
7. Sentry receives exceptions with the same correlation metadata
8. Grafana reads the backends and exposes one operational surface

## What to observe

- request latency by route and by audit phase
- queue depth, lease duration, retry count, and dead-letter volume
- audit lifecycle transitions and long-running run health
- agent execution timing and provider latency
- token usage, prompt quality, and model selection drift
- publish success rate, reconcile lag, and webhook delivery failures
- auth and entitlement failures that indicate access drift

## Correlation rules

- every audit run needs a stable audit-run correlation key
- every agent run needs to attach the parent audit run
- every publish and reconcile action needs the issue or project identifier
- every error log should be traceable back to the corresponding span
- every LLM call should inherit the same request context used by the audit run

## Operating principles

- automated instrumentation is preferred over manual one-off span wiring
- instrumentation must remain low overhead and non-blocking
- telemetry should enrich the product, not become a separate source of truth
- if a telemetry backend is unavailable, the failure should be explicit rather than silently ignored

## Production checklist

- traces appear in Phoenix and Tempo
- metrics appear in Prometheus
- logs appear in Loki
- dashboards can pivot from Grafana to the relevant trace or log line
- Sentry exceptions include the same request or audit correlation identifiers
- PostHog can answer which user flow preceded the run or failure
