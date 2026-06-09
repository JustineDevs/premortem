import { z } from 'zod';

export const evidenceRefSchema = z.object({
  kind: z.string().min(1),
  ref: z.string().min(1),
  reason: z.string().min(4)
});

export const canonicalFindingSchema = z.object({
  agent: z.string().min(1),
  finding_id: z.string().min(1),
  category: z.string().min(1),
  finding_type: z.string().min(1),
  severity: z.enum(['low', 'medium', 'high', 'critical']),
  confidence: z.number().min(0).max(1),
  predicted_failure: z.object({
    summary: z.string().min(10),
    failure_mode: z.string().optional(),
    trigger_conditions: z.array(z.string().min(4)).min(2),
    blast_radius: z.string().optional()
  }),
  why_it_matters: z.string().optional(),
  affected_assets: z.array(z.string().min(1)).min(1),
  evidence: z.array(evidenceRefSchema).min(2),
  recommended_controls: z.array(z.string().min(4)).min(2),
  dedupe_keys: z.array(z.string().min(1)).min(1),
  tags: z.array(z.string()).default([])
});

export const issueCandidateSchema = z.object({
  title: z.string().min(12),
  category: z.string().min(1),
  severity: z.enum(['low', 'medium', 'high', 'critical']),
  confidence: z.number().min(0).max(1),
  predicted_failure_summary: z.string().min(10),
  why_it_matters: z.string().min(10),
  trigger_conditions: z.array(z.string().min(4)).min(2),
  evidence: z.array(evidenceRefSchema).min(2),
  recommended_action_summary: z.string().min(10),
  implementation_steps: z.array(z.string().min(4)).min(2),
  done_criteria: z.array(z.string().min(4)).min(2),
  affected_assets: z.array(z.string().min(1)).min(1),
  source_agents: z.array(z.string().min(1)).min(1),
  source_findings: z.array(z.string().min(1)).min(1)
});

export const findingEnvelopeSchema = z.object({
  findings: z.array(canonicalFindingSchema)
});

export const issueEnvelopeSchema = z.object({
  issues: z.array(issueCandidateSchema)
});
