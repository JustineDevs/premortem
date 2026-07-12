import type { CanonicalFinding, FindingSeverity } from './types';

export interface SarifLocation {
  uri: string;
  line?: number;
  endLine?: number;
}

export interface SarifResult {
  ruleId: string;
  level: 'error' | 'warning' | 'note' | 'none';
  message: { text: string };
  locations?: Array<{
    physicalLocation: {
      artifactLocation: { uri: string };
      region?: {
        startLine?: number;
        endLine?: number;
      };
    };
  }>;
  partialFingerprints?: Record<string, string>;
  properties?: Record<string, unknown>;
}

export interface SarifRule {
  id: string;
  name: string;
  shortDescription: { text: string };
  fullDescription?: { text: string };
  helpUri?: string;
}

export interface SarifLog {
  $schema: 'https://json.schemastore.org/sarif-2.1.0.json';
  version: '2.1.0';
  runs: Array<{
    tool: {
      driver: {
        name: string;
        informationUri?: string;
        rules: SarifRule[];
      };
    };
    results: SarifResult[];
  }>;
}

function severityToLevel(severity: FindingSeverity): SarifResult['level'] {
  if (severity === 'critical' || severity === 'high') return 'error';
  if (severity === 'medium') return 'warning';
  if (severity === 'low') return 'note';
  return 'none';
}

function stableHash(input: string) {
  let value = 0;
  for (let index = 0; index < input.length; index += 1) {
    value = (value * 31 + input.charCodeAt(index)) >>> 0;
  }
  return value.toString(16);
}

function normalizeLocation(ref: string): SarifLocation | null {
  const trimmed = ref.trim();
  if (!trimmed || trimmed.includes('://')) return null;

  const lineMatch = trimmed.match(/^(.*?)(?::(\d+)(?::(\d+))?)?$/);
  if (!lineMatch) return { uri: trimmed };

  const uri = lineMatch[1]?.trim();
  if (!uri) return null;

  const line = lineMatch[2] ? Number.parseInt(lineMatch[2], 10) : undefined;
  const endLine = lineMatch[3] ? Number.parseInt(lineMatch[3], 10) : undefined;
  return {
    uri,
    ...(Number.isFinite(line) ? { line } : {}),
    ...(Number.isFinite(endLine) ? { endLine } : {})
  };
}

function firstFileLocation(finding: CanonicalFinding): SarifLocation | null {
  for (const evidence of finding.evidence) {
    if (evidence.kind !== 'file') continue;
    const location = normalizeLocation(evidence.ref);
    if (location) return location;
  }

  for (const asset of finding.affected_assets) {
    const location = normalizeLocation(asset);
    if (location) return location;
  }

  return null;
}

function ruleIdForFinding(finding: CanonicalFinding) {
  return finding.finding_type?.trim() || finding.category.trim() || finding.finding_id.trim();
}

function ruleNameForFinding(finding: CanonicalFinding) {
  return finding.category.replaceAll('_', ' ');
}

export function canonicalFindingsToSarifLog(
  findings: CanonicalFinding[],
  options?: { toolName?: string; informationUri?: string }
): SarifLog {
  const rulesById = new Map<string, SarifRule>();
  const results = findings.map((finding) => {
    const ruleId = ruleIdForFinding(finding);
    if (!rulesById.has(ruleId)) {
      rulesById.set(ruleId, {
        id: ruleId,
        name: ruleNameForFinding(finding),
        shortDescription: { text: finding.predicted_failure.summary },
        ...(finding.why_it_matters ? { fullDescription: { text: finding.why_it_matters } } : {}),
        ...(options?.informationUri ? { helpUri: options.informationUri } : {})
      });
    }

    const location = firstFileLocation(finding);
    return {
      ruleId,
      level: severityToLevel(finding.severity),
      message: {
        text: finding.predicted_failure.summary || finding.why_it_matters || finding.finding_id
      },
      ...(location
        ? {
            locations: [
              {
                physicalLocation: {
                  artifactLocation: { uri: location.uri },
                  ...(location.line || location.endLine
                    ? {
                        region: {
                          ...(location.line ? { startLine: location.line } : {}),
                          ...(location.endLine ? { endLine: location.endLine } : {})
                        }
                      }
                    : {})
                }
              }
            ]
          }
        : {}),
      partialFingerprints: {
        primaryLocationHash: stableHash(
          [
            finding.finding_id,
            finding.category,
            finding.severity,
            finding.dedupe_keys.join('|'),
            finding.affected_assets.join('|')
          ].join('::')
        )
      },
      properties: {
        agent: finding.agent,
        confidence: finding.confidence,
        findingId: finding.finding_id,
        category: finding.category,
        dedupeKeys: finding.dedupe_keys,
        tags: finding.tags
      }
    } satisfies SarifResult;
  });

  return {
    $schema: 'https://json.schemastore.org/sarif-2.1.0.json',
    version: '2.1.0',
    runs: [
      {
        tool: {
          driver: {
            name: options?.toolName ?? 'Premortem',
            ...(options?.informationUri ? { informationUri: options.informationUri } : {}),
            rules: [...rulesById.values()]
          }
        },
        results
      }
    ]
  };
}
