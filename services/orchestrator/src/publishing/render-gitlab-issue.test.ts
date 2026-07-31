import assert from 'node:assert/strict';
import test from 'node:test';

import type { IssueCandidate } from '@premortem/agent-kit';

import { renderGitLabIssue } from './render-gitlab-issue';

test('renderGitLabIssue strips GitLab quick actions from LLM content', () => {
  const issue = {
    title: 'Unsafe issue body',
    category: 'security',
    severity: 'high',
    confidence: 0.91,
    predicted_failure_summary: 'First line\n/close\nSecond line',
    why_it_matters: 'Keep users safe\n/label ~security',
    trigger_conditions: ['Normal trigger', '/close'],
    evidence: [
      { kind: 'code', ref: 'src/example.ts:10-12', reason: 'Example evidence' }
    ],
    recommended_action_summary: 'Fix the path',
    implementation_steps: ['Step one', '/label ~security'],
    done_criteria: ['Criteria one', '/close'],
    affected_assets: ['api'],
    source_agents: ['test-agent'],
    source_findings: ['finding-1']
  } as unknown as IssueCandidate;

  const rendered = renderGitLabIssue(issue, {
    auditRunId: 'audit-123',
    reviewerStatus: 'approved',
    priority: 'high'
  });

  assert.ok(rendered.includes('# Unsafe issue body'));
  assert.ok(rendered.includes('Premortem publish artifact'));
  assert.ok(rendered.includes('Evidence refs'));
  assert.ok(rendered.includes('At a glance'));
  assert.ok(rendered.includes('Traceability'));
  assert.ok(rendered.includes('Open in Premortem console'));
  assert.ok(rendered.includes('Raw AI analysis remains visible below'));
  assert.ok(rendered.includes('![Premortem]') || rendered.includes('<img src='));
  assert.ok(rendered.includes('First line'));
  assert.ok(rendered.includes('Second line'));
  assert.ok(rendered.includes('Keep users safe'));
  assert.ok(rendered.includes('Normal trigger'));
  assert.ok(rendered.includes('Step one'));
  assert.ok(rendered.includes('Criteria one'));
  assert.ok(rendered.includes('align="center"'));
  assert.ok(rendered.includes('premortem-mark.svg'));
  assert.ok(rendered.includes('width="64"'));
  assert.ok(!rendered.includes('/close'));
  assert.ok(!rendered.includes('/label'));
});
