import fs from 'node:fs';
import path from 'node:path';
import yaml from 'yaml';
import type { IssueCandidate, FindingSeverity } from './types';

export interface DedupePolicy {
  version: number;
  name: string;
  finding_level: {
    same_finding_type_weight: number;
    same_asset_weight: number;
    same_failure_mode_weight: number;
    evidence_overlap_weight: number;
    dedupe_key_overlap_weight: number;
    threshold: number;
  };
  issue_level: {
    title_normalization: boolean;
    same_owner_category_weight: number;
    same_remediation_scope_weight: number;
    trigger_overlap_weight: number;
    evidence_overlap_weight: number;
    asset_overlap_weight: number;
    threshold: number;
  };
  parent_issue_rules?: {
    merge_if_same_root_cause?: boolean;
    split_if_different_owners?: boolean;
    split_if_different_blast_radius?: boolean;
  };
}

export interface SeverityPolicy {
  version: number;
  name: string;
  severity_rules: Record<
    FindingSeverity,
    {
      blast_radius?: string[];
      confidence_min: number;
    }
  >;
  priority_mapping?: Record<FindingSeverity, string>;
}

function readPolicy<T>(rootDir: string, fileName: string) {
  const file = path.join(rootDir, '.agents', 'policies', fileName);
  const raw = fs.readFileSync(file, 'utf8');
  return yaml.parse(raw) as T;
}

export function loadDedupePolicy(rootDir: string) {
  return readPolicy<DedupePolicy>(rootDir, 'dedupe-policy.yaml');
}

export function loadSeverityPolicy(rootDir: string) {
  return readPolicy<SeverityPolicy>(rootDir, 'severity-policy.yaml');
}

const SEVERITY_ORDER: FindingSeverity[] = ['low', 'medium', 'high', 'critical'];

export function downgradeSeverityForConfidence(
  issue: IssueCandidate,
  policy: SeverityPolicy
): IssueCandidate {
  const confidence = typeof issue.confidence === 'number' ? issue.confidence : 0;
  let currentSeverity: FindingSeverity = issue.severity;

  while (true) {
    const rule = policy.severity_rules[currentSeverity];
    if (!rule || confidence >= rule.confidence_min) {
      return currentSeverity === issue.severity ? issue : { ...issue, severity: currentSeverity };
    }

    const currentIndex = SEVERITY_ORDER.indexOf(currentSeverity);
    const nextSeverity = SEVERITY_ORDER[Math.max(0, currentIndex - 1)] ?? currentSeverity;
    if (nextSeverity === currentSeverity) {
      return currentSeverity === issue.severity ? issue : { ...issue, severity: currentSeverity };
    }
    currentSeverity = nextSeverity;
  }
}
