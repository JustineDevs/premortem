import { AuditReadinessError, EntitlementError, prisma, recordActivityEvent, recordUsageEvent } from '@premortem/db';
import { DEFAULT_PREMORTEM_SITE_URL, resolvePremortemPublishSiteUrl } from '@premortem/domain';
import { captureServerException } from '@premortem/observability/server';
import { getAuditRunSnapshot } from '@premortem/orchestrator/read-model';

import type { AppEnv } from '../lib/types';

type SlackCommandAction = 'audit' | 'status';

type ParsedSlackCommand = {
  action: SlackCommandAction;
  organizationId?: string;
  projectId?: string;
  branch?: string;
  auditRunId?: string;
  responseUrl?: string;
  channelName?: string;
  userName?: string;
  teamId?: string;
  rawText?: string;
};

type SlackAttachmentButton = {
  type: 'button';
  text: { type: 'plain_text'; text: string };
  url: string;
};

type SlackBlock = Record<string, unknown>;

const SLACK_TIMESTAMP_TOLERANCE_SECONDS = 60 * 5;

function parseSlackText(text: string): Omit<ParsedSlackCommand, 'action'> {
  const normalized = text.trim();
  const tokens = normalized.split(/\s+/).filter(Boolean);

  const extractOption = (name: string) => {
    const direct = tokens.find((token) => token.startsWith(`${name}=`));
    if (direct) return direct.slice(name.length + 1).trim();
    const colon = tokens.find((token) => token.startsWith(`${name}:`));
    if (colon) return colon.slice(name.length + 1).trim();
    return '';
  };

  const organizationId = extractOption('org') || extractOption('organization') || extractOption('workspace');
  const projectId = extractOption('project') || extractOption('repo') || extractOption('repository');
  const branch = extractOption('branch') || extractOption('ref');
  const auditRunId = extractOption('audit') || extractOption('auditRunId') || extractOption('run');

  return {
    organizationId: organizationId || undefined,
    projectId: projectId || undefined,
    branch: branch || undefined,
    auditRunId: auditRunId || undefined,
    channelName: undefined,
    userName: undefined,
    teamId: undefined,
    rawText: normalized
  };
}

async function readRawBody(request: Request): Promise<string> {
  return request.text();
}

async function verifySlackSignature(request: Request, rawBody: string) {
  const secret = process.env.SLACK_SIGNING_SECRET?.trim();
  if (!secret) return { verified: false, skipped: true as const };

  const signature = request.headers.get('x-slack-signature')?.trim();
  const timestamp = request.headers.get('x-slack-request-timestamp')?.trim();
  if (!signature || !timestamp) {
    return { verified: false, skipped: false as const };
  }

  const parsedTimestamp = Number.parseInt(timestamp, 10);
  if (!Number.isFinite(parsedTimestamp)) {
    return { verified: false, skipped: false as const };
  }

  const now = Math.floor(Date.now() / 1000);
  if (Math.abs(now - parsedTimestamp) > SLACK_TIMESTAMP_TOLERANCE_SECONDS) {
    return { verified: false, skipped: false as const };
  }

  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const payload = encoder.encode(`v0:${timestamp}:${rawBody}`);
  const signatureBytes = await crypto.subtle.sign('HMAC', key, payload);
  const digest = Array.from(new Uint8Array(signatureBytes))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
  const expected = `v0=${digest}`;

  return { verified: expected === signature, skipped: false as const };
}

function parseCommandPayload(input: Record<string, string>): ParsedSlackCommand {
  const actionText = (input.action ?? input.command ?? input.text ?? '').trim().toLowerCase();
  const parsedText = parseSlackText(input.text ?? '');
  const explicitAction = input.action?.trim().toLowerCase();

  const action: SlackCommandAction =
    explicitAction === 'status' || actionText.startsWith('status')
      ? 'status'
      : 'audit';

  return {
    action,
    organizationId: input.organizationId?.trim() || parsedText.organizationId,
    projectId: input.projectId?.trim() || parsedText.projectId,
    branch: input.branch?.trim() || parsedText.branch,
    auditRunId: input.auditRunId?.trim() || parsedText.auditRunId,
    responseUrl: input.response_url?.trim() || undefined,
    channelName: input.channel_name?.trim() || undefined,
    userName: input.user_name?.trim() || undefined,
    teamId: input.team_id?.trim() || undefined,
    rawText: parsedText.rawText
  };
}

function responseUrlForAudit(auditRunId: string) {
  const siteUrl = resolvePremortemPublishSiteUrl() || DEFAULT_PREMORTEM_SITE_URL;
  const base = siteUrl.replace(/\/$/, '');
  return `${base}/app?tab=audits&audit=${encodeURIComponent(auditRunId)}`;
}

function buildIssueButtons(auditRunId: string): SlackAttachmentButton[] {
  const url = responseUrlForAudit(auditRunId);
  return [
    {
      type: 'button',
      text: { type: 'plain_text', text: 'Open in Premortem' },
      url
    }
  ];
}

function issuePreviewText(issue: {
  title: string;
  severity?: string;
  predictedFailureSummary?: string;
  evidence?: Array<{ kind: string; ref: string; reason: string; codeSnippet?: string }>;
}) {
  const evidenceSnippet = issue.evidence?.find((item) => item.codeSnippet?.trim())?.codeSnippet?.trim();
  return [
    `*${issue.title}*${issue.severity ? ` · ${issue.severity}` : ''}`,
    issue.predictedFailureSummary?.trim() ? issue.predictedFailureSummary.trim() : '',
    evidenceSnippet ? `\n\n\`\`\`ts\n${evidenceSnippet}\n\`\`\`` : ''
  ]
    .filter(Boolean)
    .join('\n');
}

function buildAuditBlocks(snapshot: Awaited<ReturnType<typeof getAuditRunSnapshot>>) {
  if (!snapshot) return [] as SlackBlock[];

  const topFindings = snapshot.issueCandidates.slice(0, 3);
  const blocks: SlackBlock[] = [
    {
      type: 'header',
      text: { type: 'plain_text', text: `Premortem audit ${snapshot.runStatus.toLowerCase()}` }
    },
    {
      type: 'section',
      fields: [
        { type: 'mrkdwn', text: `*Project*\n${snapshot.projectId}` },
        { type: 'mrkdwn', text: `*Branch*\n${snapshot.branch}` },
        { type: 'mrkdwn', text: `*Findings*\n${snapshot.counts.findings}` },
        { type: 'mrkdwn', text: `*Issue candidates*\n${snapshot.counts.issueCandidates}` }
      ]
    }
  ];

  if (topFindings.length > 0) {
    blocks.push({ type: 'divider' });
    for (const issue of topFindings) {
      blocks.push({
        type: 'section',
        text: { type: 'mrkdwn', text: issuePreviewText(issue) },
        accessory: {
          type: 'button',
          text: { type: 'plain_text', text: 'View evidence' },
          url: responseUrlForAudit(snapshot.auditRunId)
        }
      });
    }
  }

  blocks.push({
    type: 'actions',
    elements: buildIssueButtons(snapshot.auditRunId)
  });

  return blocks;
}

async function buildAuditStartResponse(
  command: ParsedSlackCommand,
  env: AppEnv,
  organizationId: string
) {
  if (!command.projectId) {
    return Response.json(
      {
        response_type: 'ephemeral',
        text: 'Project id is required. Use project=<id> branch=<name>.'
      },
      { status: 400 }
    );
  }

  if (!command.branch) {
    return Response.json(
      {
        response_type: 'ephemeral',
        text: 'Branch is required. Use branch=<name>.'
      },
      { status: 400 }
    );
  }

  const { submitAudit } = await import('@premortem/orchestrator');
  let submission: Awaited<ReturnType<typeof submitAudit>>;

  try {
    submission = await submitAudit({
      organizationId,
      projectId: command.projectId,
      branch: command.branch,
      triggeredById: command.userName ?? undefined,
      triggerSource: 'api'
    });
  } catch (error) {
    if (error instanceof EntitlementError) {
      return Response.json(
        {
          response_type: 'ephemeral',
          text: `Audit quota reached: ${error.message}`
        },
        { status: error.status }
      );
    }

    if (error instanceof AuditReadinessError) {
      return Response.json(
        {
          response_type: 'ephemeral',
          text: `Audit target is not ready: ${error.message}`
        },
        { status: 422 }
      );
    }

    throw error;
  }

  if (env.AUDIT_QUEUE && !submission.reusedActiveRun) {
    await env.AUDIT_QUEUE.send(submission.job);
  }

  await recordActivityEvent({
    organizationId,
    eventType: 'integration.slack.audit_requested',
    objectType: 'audit_run',
    objectId: submission.auditRunId,
    projectId: command.projectId,
    summary: `Slack audit request queued for ${command.projectId} on ${command.branch}`
  });

  await recordUsageEvent({
    organizationId,
    projectId: command.projectId,
    auditRunId: submission.auditRunId,
    eventType: 'audit_run',
    quantity: 1,
    unit: 'run',
    metadata: { triggerSource: 'api', integration: 'slack', branch: command.branch }
  });

  return Response.json({
    response_type: 'in_channel',
    text: `Premortem queued an audit for ${command.projectId} on ${command.branch}.`,
    blocks: [
      {
        type: 'header',
        text: { type: 'plain_text', text: 'Premortem audit queued' }
      },
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `*Project:* ${command.projectId}\n*Branch:* ${command.branch}\n*Audit run:* ${submission.auditRunId}`
        }
      },
      {
        type: 'actions',
        elements: [
          {
            type: 'button',
            text: { type: 'plain_text', text: 'Open in Premortem' },
            url: responseUrlForAudit(submission.auditRunId)
          }
        ]
      }
    ]
  });
}

async function buildAuditStatusResponse(command: ParsedSlackCommand, organizationId: string) {
  if (!command.auditRunId) {
    return Response.json(
      {
        response_type: 'ephemeral',
        text: 'Audit run id is required. Use auditRunId=<id>.'
      },
      { status: 400 }
    );
  }

  const access = await prisma.auditRun.findUnique({
    where: { id: command.auditRunId },
    select: { organizationId: true }
  });

  if (!access || access.organizationId !== organizationId) {
    return Response.json(
      { response_type: 'ephemeral', text: 'Audit run not found for this organization.' },
      { status: 404 }
    );
  }

  const snapshot = await getAuditRunSnapshot(command.auditRunId, {
    includeEvidenceSnippets: true,
    includeGraphPayload: false
  });

  if (!snapshot) {
    return Response.json(
      { response_type: 'ephemeral', text: 'Audit run snapshot is not available yet.' },
      { status: 404 }
    );
  }

  await recordActivityEvent({
    organizationId,
    eventType: 'integration.slack.audit_status_requested',
    objectType: 'audit_run',
    objectId: command.auditRunId,
    summary: `Slack requested audit status for ${command.auditRunId}`
  });

  return Response.json({
    response_type: 'in_channel',
    text: `Premortem audit ${command.auditRunId} is ${snapshot.runStatus.toLowerCase()}.`,
    blocks: buildAuditBlocks(snapshot)
  });
}

export async function handleSlackPremortemCommandPost(request: Request, env: AppEnv = {}) {
  const rawBody = await readRawBody(request);
  const verification = await verifySlackSignature(request, rawBody);
  if (!verification.verified && !verification.skipped) {
    return Response.json({ error: 'Invalid Slack signature' }, { status: 401 });
  }

  let command: ParsedSlackCommand;

  try {
    const contentType = request.headers.get('content-type')?.toLowerCase() ?? '';
    const record: Record<string, string> = {};

    if (contentType.includes('application/json')) {
      const payload = JSON.parse(rawBody) as Record<string, unknown>;
      for (const [key, value] of Object.entries(payload)) {
        if (typeof value === 'string') record[key] = value;
      }
    } else {
      const search = new URLSearchParams(rawBody);
      for (const [key, value] of search.entries()) {
        record[key] = value;
      }
    }

    command = parseCommandPayload(record);
  } catch (error) {
    captureServerException(error, { stage: 'slack.command_parse' });
    return Response.json({ error: 'Invalid Slack command payload' }, { status: 400 });
  }

  const organizationId =
    command.organizationId ?? process.env.SLACK_DEFAULT_ORGANIZATION_ID?.trim() ?? '';
  if (!organizationId) {
    return Response.json(
      {
        response_type: 'ephemeral',
        text: 'Organization id is required. Provide organizationId=<id> or configure SLACK_DEFAULT_ORGANIZATION_ID.'
      },
      { status: 400 }
    );
  }

  try {
    if (command.action === 'status') {
      return await buildAuditStatusResponse(command, organizationId);
    }

    return await buildAuditStartResponse(command, env, organizationId);
  } catch (error) {
    captureServerException(error, {
      stage: 'slack.command_handler',
      action: command.action,
      organizationId,
      projectId: command.projectId,
      auditRunId: command.auditRunId
    });

    return Response.json(
      {
        response_type: 'ephemeral',
        text: error instanceof Error ? error.message : 'Premortem Slack command failed.'
      },
      { status: 502 }
    );
  }
}
