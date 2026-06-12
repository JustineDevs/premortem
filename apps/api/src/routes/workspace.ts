import {
  createProviderConnection,
  createOrganizationApiKey,
  ensureProfileMembership,
  getWorkspaceBundle,
  getOrganizationActivityEvents,
  listUserNotifications,
  markUserNotificationsRead,
  recordActivityEvent,
  revokeOrganizationApiKey,
  stopAllAuditRuntime,
  syncProviderConnection,
  updateBillingPlan,
  updateWorkspaceLlm,
  updateWorkspaceNotifications,
  updateWorkspaceOrganization,
  updateWorkspacePolicies,
  updateWorkspaceWorkItemAttributes,
  updateWorkspaceRuntime,
  updateWorkspaceProfile,
  upsertProviderConnectionFromOAuth
} from '@premortem/db';
import { normalizeWorkItemAttributeConfig } from '@premortem/domain';

import { resolveApiActorContext } from '../lib/request-context';

export async function handleWorkspaceGet(request: Request) {
  const actor = await resolveApiActorContext(request);

  await ensureProfileMembership({
    profileId: actor.profileId,
    organizationId: actor.organizationId,
    email: actor.email
  });

  const workspace = await getWorkspaceBundle({
    organizationId: actor.organizationId,
    profileId: actor.profileId
  });
  return Response.json({ workspace });
}

export async function handleWorkspaceProfilePatch(request: Request) {
  const body = (await request.json()) as {
    fullName?: string;
    username?: string;
    timezone?: string;
    bio?: string;
  };
  const actor = await resolveApiActorContext(request);
  const profile = await updateWorkspaceProfile({
    profileId: actor.profileId,
    ...body
  });
  await recordActivityEvent({
    organizationId: actor.organizationId,
    actorId: actor.profileId,
    eventType: 'profile.updated',
    objectType: 'profile',
    objectId: actor.profileId,
    summary: 'Updated personal profile settings'
  });
  return Response.json({ ok: true, profile });
}

export async function handleWorkspaceOrganizationPatch(request: Request) {
  const body = (await request.json()) as {
    name?: string;
    billingEmail?: string;
    websiteUrl?: string;
  };
  const actor = await resolveApiActorContext(request);
  const organization = await updateWorkspaceOrganization({
    organizationId: actor.organizationId,
    ...body
  });
  await recordActivityEvent({
    organizationId: actor.organizationId,
    actorId: actor.profileId,
    eventType: 'organization.updated',
    objectType: 'organization',
    objectId: actor.organizationId,
    summary: 'Updated organization details'
  });
  return Response.json({ ok: true, organization });
}

export async function handleWorkspacePoliciesPatch(request: Request) {
  const body = (await request.json()) as {
    policies: Array<{ id: string; name: string; description: string; active: boolean }>;
  };
  const actor = await resolveApiActorContext(request);
  await updateWorkspacePolicies({
    organizationId: actor.organizationId,
    policies: body.policies
  });
  await recordActivityEvent({
    organizationId: actor.organizationId,
    actorId: actor.profileId,
    eventType: 'policies.updated',
    objectType: 'organization',
    objectId: actor.organizationId,
    summary: 'Updated enforcement policies'
  });
  return Response.json({ ok: true });
}

export async function handleWorkspaceRuntimePatch(request: Request) {
  const body = (await request.json()) as { continuousAuditEnabled?: boolean };
  if (typeof body.continuousAuditEnabled !== 'boolean') {
    return Response.json({ error: 'continuousAuditEnabled is required' }, { status: 400 });
  }
  const actor = await resolveApiActorContext(request);
  const result = await updateWorkspaceRuntime({
    organizationId: actor.organizationId,
    continuousAuditEnabled: body.continuousAuditEnabled
  });
  await recordActivityEvent({
    organizationId: actor.organizationId,
    actorId: actor.profileId,
    eventType: 'runtime.updated',
    objectType: 'organization',
    objectId: actor.organizationId,
    summary: `Continuous audit ${body.continuousAuditEnabled ? 'enabled' : 'disabled'}`
  });
  return Response.json({ ok: true, ...result });
}

export async function handleWorkspaceRuntimeStopAll(request: Request) {
  const actor = await resolveApiActorContext(request);
  const result = await stopAllAuditRuntime(actor.organizationId);
  await recordActivityEvent({
    organizationId: actor.organizationId,
    actorId: actor.profileId,
    eventType: 'runtime.stopped_all',
    objectType: 'organization',
    objectId: actor.organizationId,
    summary: 'Stopped all running audits'
  });
  return Response.json({ ok: true, ...result });
}

export async function handleWorkspaceWorkItemAttributesPatch(request: Request) {
  const body = (await request.json()) as {
    workItemAttributes?: Record<string, unknown>;
  };
  if (!body.workItemAttributes) {
    return Response.json({ error: 'workItemAttributes is required' }, { status: 400 });
  }
  const actor = await resolveApiActorContext(request);
  await updateWorkspaceWorkItemAttributes({
    organizationId: actor.organizationId,
    workItemAttributes: normalizeWorkItemAttributeConfig(body.workItemAttributes)
  });
  await recordActivityEvent({
    organizationId: actor.organizationId,
    actorId: actor.profileId,
    eventType: 'work_item_attributes.updated',
    objectType: 'organization',
    objectId: actor.organizationId,
    summary: 'Updated work item attribute automation'
  });
  return Response.json({ ok: true });
}

export async function handleWorkspaceNotificationsPatch(request: Request) {
  const body = (await request.json()) as {
    notifications: {
      slackWebhook?: string;
      slackChannel?: string;
      isSlackConnected?: boolean;
      alertEmails?: string;
      alertSeverity?: string;
    };
  };
  const actor = await resolveApiActorContext(request);
  await updateWorkspaceNotifications({
    organizationId: actor.organizationId,
    notifications: body.notifications
  });
  await recordActivityEvent({
    organizationId: actor.organizationId,
    actorId: actor.profileId,
    eventType: 'notifications.updated',
    objectType: 'organization',
    objectId: actor.organizationId,
    summary: 'Updated webhook and notification settings'
  });
  return Response.json({ ok: true });
}

export async function handleWorkspaceNotificationsGet(request: Request) {
  const actor = await resolveApiActorContext(request);
  const url = new URL(request.url);
  const limitRaw = url.searchParams.get('limit');
  const parsedLimit = limitRaw ? Number.parseInt(limitRaw, 10) : 20;
  const limit = Number.isFinite(parsedLimit) ? Math.min(Math.max(parsedLimit, 1), 100) : 20;
  const notifications = await listUserNotifications({
    userId: actor.profileId,
    organizationId: actor.organizationId,
    limit
  });
  return Response.json({ notifications });
}

export async function handleWorkspaceNotificationsRead(request: Request) {
  const actor = await resolveApiActorContext(request);
  const body = (await request.json()) as { notificationIds?: string[] };
  const result = await markUserNotificationsRead({
    userId: actor.profileId,
    organizationId: actor.organizationId,
    notificationIds: body.notificationIds
  });
  return Response.json({ ok: true, updatedCount: result.count });
}

export async function handleWorkspaceLlmPatch(request: Request) {
  const body = (await request.json()) as {
    llm: {
      selectedGeminiModel?: string;
      maxTokens?: number;
      temperature?: number;
      customProviders?: Array<{ name: string; host: string; model: string; active: boolean }>;
      vendorRouting?: Array<{
        id: string;
        label: string;
        description: string;
        kind: 'managed' | 'custom' | 'auto_discover';
        providerRef: string;
        enabled: boolean;
      }>;
    };
  };
  const actor = await resolveApiActorContext(request);
  await updateWorkspaceLlm({
    organizationId: actor.organizationId,
    llm: body.llm
  });
  await recordActivityEvent({
    organizationId: actor.organizationId,
    actorId: actor.profileId,
    eventType: 'llm.updated',
    objectType: 'organization',
    objectId: actor.organizationId,
    summary: 'Updated LLM provider settings'
  });
  return Response.json({ ok: true });
}

export async function handleWorkspaceIntegrationsPost(request: Request) {
  const body = (await request.json()) as {
    provider?: 'gitlab' | 'github';
    externalAccountName?: string;
    externalAccountId?: string;
    accessScope?: Record<string, unknown>;
    accessToken?: string;
    refreshToken?: string;
    expiresInSeconds?: number;
  };

  const actor = await resolveApiActorContext(request);

  if (body.accessToken && body.externalAccountId && body.externalAccountName) {
    const connection = await upsertProviderConnectionFromOAuth({
      organizationId: actor.organizationId,
      createdById: actor.profileId,
      provider: body.provider ?? 'gitlab',
      externalAccountId: body.externalAccountId,
      externalAccountName: body.externalAccountName,
      accessToken: body.accessToken,
      refreshToken: body.refreshToken,
      accessScope: body.accessScope,
      expiresInSeconds: body.expiresInSeconds
    });
    await recordActivityEvent({
      organizationId: actor.organizationId,
      actorId: actor.profileId,
      eventType: 'integration.connected',
      objectType: 'provider_connection',
      objectId: connection.id,
      summary: `Connected ${connection.provider} account ${connection.externalAccountName ?? connection.externalAccountId ?? connection.provider}`
    });
    return Response.json({ ok: true, connection });
  }

  if (!body.externalAccountName?.trim()) {
    return Response.json({ error: 'externalAccountName is required' }, { status: 400 });
  }

  const connection = await createProviderConnection({
    organizationId: actor.organizationId,
    createdById: actor.profileId,
    provider: body.provider ?? 'gitlab',
    externalAccountName: body.externalAccountName.trim(),
    externalAccountId: body.externalAccountId?.trim(),
    accessScope: body.accessScope,
    accessToken: body.accessToken
  });

  await recordActivityEvent({
    organizationId: actor.organizationId,
    actorId: actor.profileId,
    eventType: 'integration.created',
    objectType: 'provider_connection',
    objectId: connection.id,
    summary: `Created ${connection.provider} connection ${connection.externalAccountName ?? connection.externalAccountId ?? connection.provider}`
  });

  return Response.json({ ok: true, connection });
}

export async function handleWorkspaceIntegrationSync(request: Request, connectionId: string) {
  const connection = await syncProviderConnection(connectionId);
  return Response.json({ ok: true, connection });
}

export async function handleWorkspaceBillingPatch(request: Request) {
  const body = (await request.json()) as { plan?: 'free' | 'pro' | 'team' | 'enterprise' };
  if (!body.plan) {
    return Response.json({ error: 'plan is required' }, { status: 400 });
  }
  const actor = await resolveApiActorContext(request);
  try {
    const billing = await updateBillingPlan({
      organizationId: actor.organizationId,
      plan: body.plan
    });
    await recordActivityEvent({
      organizationId: actor.organizationId,
      actorId: actor.profileId,
      eventType: 'billing.plan_changed',
      objectType: 'organization_billing_account',
      summary: `Updated billing plan to ${body.plan}`
    });
    return Response.json({ ok: true, billing });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : 'Billing update failed' },
      { status: 402 }
    );
  }
}

function escapeCsv(value: unknown) {
  const text = value === null || value === undefined ? '' : String(value);
  if (/[",\n]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
}

export async function handleWorkspaceActivityExport(request: Request) {
  const actor = await resolveApiActorContext(request);
  const url = new URL(request.url);
  const format = url.searchParams.get('format') === 'csv' ? 'csv' : 'json';
  const events = await getOrganizationActivityEvents(actor.organizationId);

  if (format === 'csv') {
    const header = [
      'createdAt',
      'eventType',
      'objectType',
      'objectId',
      'actorName',
      'actorEmail',
      'summary'
    ];
    const rows = events.map((event) => [
      event.createdAt,
      event.eventType,
      event.objectType,
      event.objectId ?? '',
      event.actorName ?? '',
      event.actorEmail ?? '',
      event.summary ?? ''
    ]);
    const csv = [header, ...rows]
      .map((row) => row.map((cell) => escapeCsv(cell)).join(','))
      .join('\n');
    return new Response(csv, {
      headers: {
        'content-type': 'text/csv; charset=utf-8',
        'content-disposition': 'attachment; filename="premortem-activity-export.csv"'
      }
    });
  }

  return Response.json({ events });
}

export async function handleWorkspaceApiKeysPost(request: Request) {
  const body = (await request.json()) as { label?: string };
  if (!body.label?.trim()) {
    return Response.json({ error: 'label is required' }, { status: 400 });
  }

  const actor = await resolveApiActorContext(request);
  const apiKey = await createOrganizationApiKey({
    organizationId: actor.organizationId,
    createdById: actor.profileId,
    label: body.label
  });
  await recordActivityEvent({
    organizationId: actor.organizationId,
    actorId: actor.profileId,
    eventType: 'api_key.created',
    objectType: 'organization_api_key',
    objectId: apiKey.key.id,
    summary: `Created API key ${apiKey.key.label}`
  });
  return Response.json({ ok: true, apiKey });
}

export async function handleWorkspaceApiKeyDelete(request: Request, keyId: string) {
  const actor = await resolveApiActorContext(request);
  const result = await revokeOrganizationApiKey({
    organizationId: actor.organizationId,
    keyId
  });
  if (result.count === 0) {
    return Response.json({ error: 'API key not found' }, { status: 404 });
  }

  await recordActivityEvent({
    organizationId: actor.organizationId,
    actorId: actor.profileId,
    eventType: 'api_key.revoked',
    objectType: 'organization_api_key',
    objectId: keyId,
    summary: 'Revoked API key'
  });

  return Response.json({ ok: true });
}
