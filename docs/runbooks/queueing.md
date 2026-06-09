# Queueing runbook

- Audit create requests enqueue jobs with idempotency keys.
- Workers lease jobs before execution.
- Retries are capped per queue.
- Poison jobs move to dead-letter storage.
- Cancellation marks runs terminal and prevents lease renewal.
