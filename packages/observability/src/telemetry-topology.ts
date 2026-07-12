export interface TelemetryTopologySnapshot {
  collectorUrl: string;
  prometheusUrl?: string;
  lokiUrl?: string;
  tempoUrl?: string;
  grafanaUrl?: string;
  signals: {
    traces: 'phoenix' | 'otlp';
    metrics: 'prometheus' | 'otlp';
    logs: 'loki' | 'otlp';
  };
}

function normalizeUrl(value: string | undefined) {
  const trimmed = value?.trim();
  if (!trimmed) return undefined;
  return trimmed.replace(/\/$/, '');
}

function resolveCollectorUrl() {
  return (
    normalizeUrl(process.env.PHOENIX_COLLECTOR_ENDPOINT) ??
    normalizeUrl(process.env.PHOENIX_BASE_URL) ??
    normalizeUrl(process.env.OTEL_EXPORTER_OTLP_ENDPOINT)
  );
}

export function describeTelemetryTopology(): TelemetryTopologySnapshot {
  const collectorUrl = resolveCollectorUrl();
  if (!collectorUrl) {
    throw new Error(
      'Telemetry transport is required. Set PHOENIX_COLLECTOR_ENDPOINT, PHOENIX_BASE_URL, or OTEL_EXPORTER_OTLP_ENDPOINT.'
    );
  }

  const prometheusUrl = normalizeUrl(process.env.PROMETHEUS_URL ?? process.env.GRAFANA_PROMETHEUS_URL);
  const lokiUrl = normalizeUrl(process.env.LOKI_URL ?? process.env.GRAFANA_LOKI_URL);
  const tempoUrl = normalizeUrl(process.env.TEMPO_URL ?? process.env.GRAFANA_TEMPO_URL);
  const grafanaUrl = normalizeUrl(process.env.GRAFANA_URL);

  return {
    collectorUrl,
    prometheusUrl,
    lokiUrl,
    tempoUrl,
    grafanaUrl,
    signals: {
      traces: process.env.PHOENIX_COLLECTOR_ENDPOINT?.trim() ? 'phoenix' : 'otlp',
      metrics: prometheusUrl ? 'prometheus' : 'otlp',
      logs: lokiUrl ? 'loki' : 'otlp'
    }
  };
}

export function isTelemetryTopologyConfigured() {
  try {
    describeTelemetryTopology();
    return true;
  } catch {
    return false;
  }
}

