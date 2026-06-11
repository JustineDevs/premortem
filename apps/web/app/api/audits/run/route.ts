import { NextResponse } from 'next/server';
import { randomUUID } from 'node:crypto';

import { validateInput, recordAuditStep } from '@premortem/security';
import {
  fetchRuntimeAuditSnapshot,
  fetchRuntimeProjects,
  pollRuntimeAuditUntilComplete,
  submitRuntimeAudit
} from '@/lib/premortem-api/client';
import { mapSandboxScanToAuditRun } from '@/lib/premortem-api/map-sandbox-audit';
import { mapSnapshotToAuditRun } from '@/lib/premortem-api/map-runtime-to-console';
import { actorHeaders, resolveRequestActorContext } from '@/lib/server/request-context';

export async function POST(request: Request) {
  const body = (await request.json()) as {
    projectId?: string;
    branch?: string;
    customSnippet?: string;
  };

  if (body.customSnippet?.trim()) {
    const runId = randomUUID();
    const guard = validateInput(body.customSnippet);
    if (!guard.passed) {
      recordAuditStep(runId, 'input_guardrail', 'sandbox', 'blocked', guard.violation);
      return NextResponse.json({ error: guard.violation }, { status: 400 });
    }
    recordAuditStep(runId, 'input_guardrail', 'sandbox', 'passed');
    const audit = mapSandboxScanToAuditRun(body.customSnippet);
    return NextResponse.json({ success: true, audit, sandbox: true });
  }

  try {
    const context = await resolveRequestActorContext();
    const headers = actorHeaders(context);

    let projectId = body.projectId;
    if (!projectId) {
      const projects = await fetchRuntimeProjects(headers);
      const firstProject = projects[0] as { id?: string } | undefined;
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
      branch: body.branch ?? 'main',
      commitSha: `console-${Date.now()}`,
      triggeredById: context.profileId,
      headers
    });

    const snapshot = await pollRuntimeAuditUntilComplete(submission.auditRunId, 120000, headers);
    const projects = await fetchRuntimeProjects(headers);
    const projectRow = projects.find(
      (project) => String((project as { id: string }).id) === snapshot.projectId
    ) as { name?: string } | undefined;
    const projectName = projectRow?.name ?? snapshot.projectId;
    const audit = mapSnapshotToAuditRun(snapshot, projectName);

    return NextResponse.json({ success: true, audit, snapshot });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Audit run failed' },
      { status: error instanceof Error && error.message === 'Unauthorized' ? 401 : 502 }
    );
  }
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const auditRunId = url.searchParams.get('auditRunId');
  if (!auditRunId) {
    return NextResponse.json({ error: 'auditRunId is required' }, { status: 400 });
  }

  try {
    const context = await resolveRequestActorContext();
    const snapshot = await fetchRuntimeAuditSnapshot(auditRunId, actorHeaders(context));
    return NextResponse.json({ snapshot });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to load audit snapshot' },
      { status: 502 }
    );
  }
}
