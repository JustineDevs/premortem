import { captureServerException } from '@premortem/observability/server';
import { nangoProxy } from '@premortem/integrations';

export type SlackNotificationKind =
  | 'audit_completed'
  | 'audit_failed'
  | 'issues_ready'
  | 'issue_published'
  | 'critical_finding'
  | 'member_invited'
  | 'billing_notice';

export type SlackAlertSeverity = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

export interface SlackDeliveryConfig {
  organizationId: string;
  webhookUrl?: string | null;
  channel?: string | null;
  isSlackConnected?: boolean | null;
  alertSeverity?: string | null;
  nangoConnectionId?: string | null;
  nangoProviderKey?: string | null;
}

export interface SlackNotificationInput {
  organizationId: string;
  kind: SlackNotificationKind;
  title: string;
  body?: string | null;
  url?: string | null;
  severity?: SlackAlertSeverity | string | null;
  metadata?: Record<string, unknown> | null;
}

const SEVERITY_RANK: Record<SlackAlertSeverity, number> = {
  LOW: 0,
  MEDIUM: 1,
  HIGH: 2,
  CRITICAL: 3
};

const EVENT_SEVERITY: Record<SlackNotificationKind, SlackAlertSeverity> = {
  audit_completed: 'LOW',
  audit_failed: 'HIGH',
  issues_ready: 'MEDIUM',
  issue_published: 'MEDIUM',
  critical_finding: 'CRITICAL',
  member_invited: 'LOW',
  billing_notice: 'MEDIUM'
};

function escapeSlackMarkup(value: string) {
  return value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
}

function normalizeSeverity(value: string | null | undefined): SlackAlertSeverity {
  const upper = value?.trim().toUpperCase();
  if (upper === 'LOW' || upper === 'MEDIUM' || upper === 'HIGH' || upper === 'CRITICAL') {
    return upper;
  }
  return 'HIGH';
}

function buildSlackText(input: SlackNotificationInput, channel?: string | null) {
  const lines = [
    `Premortem ${input.kind.replaceAll('_', ' ')}`,
    input.title,
    input.body?.trim() ? input.body.trim() : '',
    channel?.trim() ? `Channel: #${channel.trim()}` : ''
  ].filter(Boolean);
  return lines.join('\n\n');
}

function buildSlackBlocks(input: SlackNotificationInput, channel?: string | null) {
  const emoji: Record<SlackNotificationKind, string> = {
    audit_completed: ':white_check_mark:',
    audit_failed: ':x:',
    issues_ready: ':mag:',
    issue_published: ':outbox_tray:',
    critical_finding: ':rotating_light:',
    member_invited: ':wave:',
    billing_notice: ':receipt:'
  };

  const blocks: Array<Record<string, unknown>> = [
    {
      type: 'header',
      text: {
        type: 'plain_text',
        text: `${emoji[input.kind]} Premortem: ${input.kind.replaceAll('_', ' ')}`
      }
    },
    {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: escapeSlackMarkup(
          [input.title, input.body?.trim() ?? ''].filter(Boolean).join('\n\n')
        )
      }
    }
  ];

  if (input.url?.trim()) {
    blocks.push({
      type: 'actions',
      elements: [
        {
          type: 'button',
          text: { type: 'plain_text', text: 'View in Premortem' },
          url: input.url.trim()
        }
      ]
    });
  }

  blocks.push({
    type: 'context',
    elements: [
      {
        type: 'mrkdwn',
        text: escapeSlackMarkup(
          `Organization: ${input.organizationId}${channel?.trim() ? ` | Channel: #${channel.trim()}` : ''}`
        )
      }
    ]
  });

  return blocks;
}

function shouldDeliverSlackNotification(
  input: SlackNotificationInput,
  delivery: SlackDeliveryConfig
): boolean {
  if (!delivery.isSlackConnected) return false;

  const threshold = normalizeSeverity(delivery.alertSeverity);
  const severity = normalizeSeverity(input.severity ?? EVENT_SEVERITY[input.kind]);
  if (SEVERITY_RANK[severity] < SEVERITY_RANK[threshold]) return false;

  return Boolean(delivery.webhookUrl?.trim() || (delivery.nangoConnectionId && delivery.nangoProviderKey));
}

export async function sendSlackNotification(
  input: SlackNotificationInput,
  delivery: SlackDeliveryConfig
): Promise<{ delivered: boolean; transport: 'webhook' | 'nango' | 'skipped' }> {
  if (!shouldDeliverSlackNotification(input, delivery)) {
    return { delivered: false, transport: 'skipped' };
  }

  const blocks = buildSlackBlocks(input, delivery.channel);
  const text = buildSlackText(input, delivery.channel);

  if (delivery.nangoConnectionId && delivery.nangoProviderKey) {
    if (!delivery.channel?.trim()) {
      captureServerException(
        new Error('Slack Nango delivery requires a configured channel'),
        {
          organizationId: input.organizationId,
          kind: input.kind,
          transport: 'nango'
        }
      );
      return { delivered: false, transport: 'skipped' };
    }

    const response = await nangoProxy({
      connectionId: delivery.nangoConnectionId,
      providerConfigKey: delivery.nangoProviderKey,
      method: 'POST',
      baseUrlOverride: 'https://slack.com/api',
      endpoint: '/chat.postMessage',
      data: {
        channel: delivery.channel,
        text,
        blocks
      }
    });

    const responseData = response as {
      status?: number;
      data?: { ok?: boolean; error?: string };
    };

    if (responseData.data?.ok === false || (responseData.status && responseData.status >= 400)) {
      throw new Error(
        `Slack Nango delivery failed: ${responseData.status ?? 'unknown'} ${responseData.data?.error ?? 'unknown_error'}`
      );
    }

    return { delivered: true, transport: 'nango' };
  }

  const webhookUrl = delivery.webhookUrl?.trim();
  if (!webhookUrl) {
    return { delivered: false, transport: 'skipped' };
  }

  const response = await fetch(webhookUrl, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ text, blocks })
  });

  if (!response.ok) {
    const body = await response.text().catch(() => '');
    throw new Error(`Slack webhook failed: ${response.status} ${body}`);
  }

  return { delivered: true, transport: 'webhook' };
}
