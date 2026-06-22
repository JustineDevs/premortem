import { NextResponse } from 'next/server';
import { randomUUID } from 'node:crypto';

import { validateInput, recordAuditStep } from '@premortem/security';
import { recordActivityEvent } from '@premortem/db';
import {
  fetchRuntimeAuditSnapshot,
  fetchRuntimeProjects,
  submitRuntimeAudit
} from '@/lib/premortem-api/client';
import { mapSandboxScanToAuditRun } from '@/lib/premortem-api/map-sandbox-audit';
import { bffErrorResponse } from '@/lib/server/bff-errors';
import { readJsonRecord, readOptionalString, readRequiredString } from '@/lib/server/request-body';
import { actorHeaders, resolveRequestActorContext } from '@/lib/server/request-context';

export async function POST(request: Request) {
  const body = await readJsonRecord(request);
  if (!body) {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const customSnippet = readOptionalString(body, 'customSnippet')?.trim();
  if (customSnippet) {
    const runId = randomUUID();
    const guard = validateInput(customSnippet);
    const context = await resolveRequestActorContext(request);
    if (!guard.passed) {
      await recordAuditStep(
        runId,
        'input_guardrail',
        'sandbox',
        'blocked',
        guard.violation,
        async (entry) => {
          await recordActivityEvent({
            organizationId: context.organizationId,
            actorId: context.profileId,
            eventType: 'sandbox.audit_step.blocked',
            objectType: 'sandbox_scan',
            objectId: runId,
            summary: `${entry.step} ${entry.status}: ${entry.detail ?? 'blocked'}`
          });
        }
      );
      await recordActivityEvent({
        organizationId: context.organizationId,
        actorId: context.profileId,
        eventType: 'sandbox.static_scan.blocked',
        objectType: 'sandbox_scan',
        objectId: runId,
        summary: `Sandbox scan blocked by input guardrail: ${guard.violation}`
      });
      return NextResponse.json({ error: guard.violation }, { status: 400 });
    }
    await recordAuditStep(runId, 'input_guardrail', 'sandbox', 'passed', undefined, async (entry) => {
      await recordActivityEvent({
        organizationId: context.organizationId,
        actorId: context.profileId,
        eventType: 'sandbox.audit_step.passed',
        objectType: 'sandbox_scan',
        objectId: runId,
        summary: `${entry.step} ${entry.status}`
      });
    });
    try {
      const audit = await mapSandboxScanToAuditRun(customSnippet);
      await recordActivityEvent({
        organizationId: context.organizationId,
        actorId: context.profileId,
        eventType: 'sandbox.static_scan.completed',
        objectType: 'sandbox_scan',
        objectId: runId,
        summary: `Sandbox analysis completed with score ${audit.score}`
      });
      return NextResponse.json({ success: true, audit, sandbox: true });
    } catch (error) {
      return NextResponse.json(
        {
          error:
            error instanceof Error
              ? error.message
              : 'Sandbox scan requires a configured LLM provider.'
        },
        { status: 503 }
      );
    }
  }

  try {
    const context = await resolveRequestActorContext(request);
    const headers = actorHeaders(context);
    const requestedProjectId = readRequiredString(body, 'projectId');
    const requestedBranch = readOptionalString(body, 'branch')?.trim();

    let projectId = requestedProjectId ?? undefined;
    if (!projectId) {
      const projects = await fetchRuntimeProjects(headers);
      const firstProject = projects[0];
      if (!firstProject?.id) {
        return NextResponse.json(
          { error: 'Connect a repository before running an audit.' },
          { status: 400 }
        );
      }
      projectId = String(firstProject.id);
    }

    const submission = await submitRuntimeAudit({
      organizationId: context.organizationId,
      projectId,
      branch: requestedBranch || 'main',
      commitSha: `console-${Date.now()}`,
      triggeredById: context.profileId,
      headers
    });

    return NextResponse.json(
      {
        success: true,
        async: true,
        auditRunId: submission.auditRunId,
        runStatus: submission.runStatus,
        message: 'Audit queued. Open Audits to track progress while the swarm runs.'
      },
      { status: 202 }
    );
  } catch (error) {
    return bffErrorResponse(error, 'Audit run failed');
  }
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const auditRunId = url.searchParams.get('auditRunId');
  if (!auditRunId) {
    return NextResponse.json({ error: 'auditRunId is required' }, { status: 400 });
  }

  try {
    const context = await resolveRequestActorContext(request);
    const snapshot = await fetchRuntimeAuditSnapshot(auditRunId, actorHeaders(context));
    return NextResponse.json({ snapshot });
  } catch (error) {
    return bffErrorResponse(error, 'Failed to load audit snapshot');
  }
}
