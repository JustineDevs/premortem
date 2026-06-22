import {
  createOrganizationApiKey,
  createOrganizationInvitation,
  createProviderConnection,
  EntitlementError,
  getWorkspaceBundle,
  getOrganizationActivityEvents,
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
import {
  createOrganizationNotifications,
  listUserNotifications,
  markUserNotificationsRead
} from '@premortem/db/notifications';
import { createNangoConnectSession } from '@premortem/integrations';
import { normalizeWorkItemAttributeConfig } from '@premortem/domain';

import { apiErrorResponse } from '../lib/error-response';
import { resolveApiActorContext } from '../lib/request-context';
import { BILLING_ROLES, ORG_ADMIN_ROLES, ORG_WRITE_ROLES, requireApiRole } from '../lib/authorization';
import {
  readJsonRecord,
  readOptionalBoolean,
  readOptionalRecord,
  readOptionalString,
  readOptionalStringArray,
  readOptionalStringLiteral,
  readRequiredString
} from '../lib/request-body';

export async function handleWorkspaceGet(request: Request) {
  const actor = await resolveApiActorContext(request);

  const workspace = await getWorkspaceBundle({
    organizationId: actor.organizationId,
    profileId: actor.profileId
  });
  return Response.json({ workspace });
}

export async function handleWorkspaceProfilePatch(request: Request) {
  const body = (await readJsonRecord(request)) ?? {};
  const actor = await resolveApiActorContext(request);
  requireApiRole(actor, ORG_WRITE_ROLES);
  const profile = await updateWorkspaceProfile({
    profileId: actor.profileId,
    fullName: readOptionalString(body, 'fullName'),
    username: readOptionalString(body, 'username'),
    timezone: readOptionalString(body, 'timezone'),
    bio: readOptionalString(body, 'bio')
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
  const body = (await readJsonRecord(request)) ?? {};
  const actor = await resolveApiActorContext(request);
  requireApiRole(actor, ORG_ADMIN_ROLES);
  const organization = await updateWorkspaceOrganization({
    organizationId: actor.organizationId,
    name: readOptionalString(body, 'name'),
    billingEmail: readOptionalString(body, 'billingEmail'),
    websiteUrl: readOptionalString(body, 'websiteUrl')
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
  const body = (await readJsonRecord(request)) ?? {};
  const policies = body.policies;
  if (!Array.isArray(policies)) {
    return Response.json({ error: 'policies is required' }, { status: 400 });
  }
  const actor = await resolveApiActorContext(request);
  requireApiRole(actor, ORG_ADMIN_ROLES);
  await updateWorkspacePolicies({
    organizationId: actor.organizationId,
    policies: policies.map((policy) => ({
      id: String(policy && typeof policy === 'object' ? (policy as Record<string, unknown>).id ?? '' : ''),
      name: String(policy && typeof policy === 'object' ? (policy as Record<string, unknown>).name ?? '' : ''),
      description: String(
        policy && typeof policy === 'object'
          ? (policy as Record<string, unknown>).description ?? ''
          : ''
      ),
      active:
        Boolean(policy && typeof policy === 'object' ? (policy as Record<string, unknown>).active : false)
    }))
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
  const body = (await readJsonRecord(request)) ?? {};
  const continuousAuditEnabled = readOptionalBoolean(body, 'continuousAuditEnabled');
  if (typeof continuousAuditEnabled !== 'boolean') {
    return Response.json({ error: 'continuousAuditEnabled is required' }, { status: 400 });
  }
  const actor = await resolveApiActorContext(request);
  requireApiRole(actor, ORG_ADMIN_ROLES);
  const result = await updateWorkspaceRuntime({
    organizationId: actor.organizationId,
    continuousAuditEnabled
  });
  await recordActivityEvent({
    organizationId: actor.organizationId,
    actorId: actor.profileId,
    eventType: 'runtime.updated',
    objectType: 'organization',
    objectId: actor.organizationId,
    summary: `Continuous audit ${continuousAuditEnabled ? 'enabled' : 'disabled'}`
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
  const body = (await readJsonRecord(request)) ?? {};
  const workItemAttributes = readOptionalRecord(body, 'workItemAttributes');
  if (!workItemAttributes) {
    return Response.json({ error: 'workItemAttributes is required' }, { status: 400 });
  }
  const actor = await resolveApiActorContext(request);
  requireApiRole(actor, ORG_ADMIN_ROLES);
  await updateWorkspaceWorkItemAttributes({
    organizationId: actor.organizationId,
    workItemAttributes: normalizeWorkItemAttributeConfig(workItemAttributes)
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
  const body = (await readJsonRecord(request)) ?? {};
  const notifications = readOptionalRecord(body, 'notifications');
  if (!notifications) {
    return Response.json({ error: 'notifications is required' }, { status: 400 });
  }
  const notificationSettings = {
    slackWebhook: readOptionalString(notifications, 'slackWebhook'),
    slackChannel: readOptionalString(notifications, 'slackChannel'),
    isSlackConnected: readOptionalBoolean(notifications, 'isSlackConnected'),
    alertEmails: readOptionalString(notifications, 'alertEmails'),
    alertSeverity: readOptionalStringLiteral(notifications, 'alertSeverity', [
      'LOW',
      'MEDIUM',
      'HIGH',
      'CRITICAL'
    ]),
    slackNangoConnectionId: readOptionalString(notifications, 'slackNangoConnectionId'),
    slackNangoProviderKey: readOptionalString(notifications, 'slackNangoProviderKey')
  };
  const actor = await resolveApiActorContext(request);
  requireApiRole(actor, ORG_ADMIN_ROLES);
  await updateWorkspaceNotifications({
    organizationId: actor.organizationId,
    notifications: notificationSettings
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
  const body = (await readJsonRecord(request)) ?? {};
  const result = await markUserNotificationsRead({
    userId: actor.profileId,
    organizationId: actor.organizationId,
    notificationIds: readOptionalStringArray(body, 'notificationIds') ?? undefined
  });
  return Response.json({ ok: true, updatedCount: result.count });
}

export async function handleWorkspaceLlmPatch(request: Request) {
  const body = (await readJsonRecord(request)) ?? {};
  const llm = readOptionalRecord(body, 'llm');
  if (!llm) {
    return Response.json({ error: 'llm is required' }, { status: 400 });
  }
  const actor = await resolveApiActorContext(request);
  requireApiRole(actor, ORG_ADMIN_ROLES);
  const customProviders = Array.isArray(llm.customProviders)
    ? llm.customProviders
        .filter((provider) => provider && typeof provider === 'object')
        .map((provider) => ({
          name: String((provider as Record<string, unknown>).name ?? ''),
          host: String((provider as Record<string, unknown>).host ?? ''),
          model: String((provider as Record<string, unknown>).model ?? ''),
          active: (provider as Record<string, unknown>).active === true
        }))
    : undefined;
  const vendorRouting = Array.isArray(llm.vendorRouting)
    ? llm.vendorRouting
        .filter((tier) => tier && typeof tier === 'object')
        .map((tier) => ({
          id: String((tier as Record<string, unknown>).id ?? ''),
          label: String((tier as Record<string, unknown>).label ?? ''),
          description: String((tier as Record<string, unknown>).description ?? ''),
          kind:
            readOptionalStringLiteral(tier as Record<string, unknown>, 'kind', [
              'managed',
              'custom',
              'auto_discover'
            ]) ?? 'managed',
          providerRef: String((tier as Record<string, unknown>).providerRef ?? ''),
          enabled: (tier as Record<string, unknown>).enabled === true
        }))
    : undefined;
  await updateWorkspaceLlm({
    organizationId: actor.organizationId,
    llm: {
      selectedGeminiModel: readOptionalString(llm, 'selectedGeminiModel'),
      maxTokens:
        typeof llm.maxTokens === 'number' && Number.isFinite(llm.maxTokens)
          ? llm.maxTokens
          : undefined,
      temperature:
        typeof llm.temperature === 'number' && Number.isFinite(llm.temperature)
          ? llm.temperature
          : undefined,
      customProviders,
      vendorRouting
    }
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
  const body = (await readJsonRecord(request)) ?? {};

  const actor = await resolveApiActorContext(request);
  requireApiRole(actor, ORG_ADMIN_ROLES);

  const provider = readOptionalString(body, 'provider');
  const externalAccountName = readOptionalString(body, 'externalAccountName');
  const externalAccountId = readOptionalString(body, 'externalAccountId');
  const accessToken = readOptionalString(body, 'accessToken');
  const refreshToken = readOptionalString(body, 'refreshToken');
  const nangoConnectionId = readOptionalString(body, 'nangoConnectionId');
  const nangoProviderKey = readOptionalString(body, 'nangoProviderKey');

  if (accessToken && externalAccountId && externalAccountName) {
    const connection = await upsertProviderConnectionFromOAuth({
      organizationId: actor.organizationId,
      createdById: actor.profileId,
      provider: provider === 'github' ? 'github' : 'gitlab',
      externalAccountId,
      externalAccountName,
      accessToken,
      refreshToken: refreshToken ?? undefined,
      accessScope: readOptionalRecord(body, 'accessScope') ?? undefined,
      expiresInSeconds: typeof body.expiresInSeconds === 'number' ? body.expiresInSeconds : undefined,
      nangoConnectionId: nangoConnectionId ?? undefined,
      nangoProviderKey: nangoProviderKey ?? undefined
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

  if (!externalAccountName?.trim()) {
    return Response.json({ error: 'externalAccountName is required' }, { status: 400 });
  }

  const connection = await createProviderConnection({
    organizationId: actor.organizationId,
    createdById: actor.profileId,
    provider: provider === 'github' ? 'github' : 'gitlab',
    externalAccountName: externalAccountName.trim(),
    externalAccountId: externalAccountId?.trim(),
    accessScope: readOptionalRecord(body, 'accessScope') ?? undefined,
    accessToken: accessToken ?? undefined,
    nangoConnectionId: nangoConnectionId ?? undefined,
    nangoProviderKey: nangoProviderKey ?? undefined
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

export async function handleWorkspaceNangoConnectSessionPost(request: Request) {
  const body = (await readJsonRecord(request)) ?? {};
  const actor = await resolveApiActorContext(request);
  requireApiRole(actor, ORG_ADMIN_ROLES);
  const tags = readOptionalRecord(body, 'tags');
  const overrides = readOptionalRecord(body, 'overrides');
  const providerConfigKey = readOptionalString(body, 'providerConfigKey');
  const allowedIntegrations = readOptionalStringArray(body, 'allowedIntegrations');
  const stringTags = tags
    ? Object.fromEntries(
        Object.entries(tags).filter((entry): entry is [string, string] => typeof entry[1] === 'string')
      )
    : undefined;
  const session = await createNangoConnectSession({
    tags: {
      organization_id: actor.organizationId,
      end_user_id: actor.profileId,
      ...(actor.email ? { end_user_email: actor.email } : {}),
      ...(stringTags ?? {})
    },
    ...(providerConfigKey
      ? {
          allowedIntegrations: allowedIntegrations?.length ? allowedIntegrations : [providerConfigKey]
        }
      : allowedIntegrations?.length
        ? { allowedIntegrations }
        : {}),
    ...(overrides ? { overrides } : {})
  });
  return Response.json({ ok: true, ...session });
}

export async function handleWorkspaceIntegrationSync(request: Request, connectionId: string) {
  const actor = await resolveApiActorContext(request);
  requireApiRole(actor, ORG_ADMIN_ROLES);
  const connection = await syncProviderConnection(connectionId);
  return Response.json({ ok: true, connection });
}

export async function handleWorkspaceBillingPatch(request: Request) {
  const body = (await readJsonRecord(request)) ?? {};
  const plan = readOptionalStringLiteral(body, 'plan', ['free', 'pro', 'team', 'enterprise']);
  if (!plan) {
    return Response.json({ error: 'plan is required' }, { status: 400 });
  }
  const actor = await resolveApiActorContext(request);
  requireApiRole(actor, BILLING_ROLES);
  try {
    const billing = await updateBillingPlan({
      organizationId: actor.organizationId,
      plan
    });
    await recordActivityEvent({
      organizationId: actor.organizationId,
      actorId: actor.profileId,
      eventType: 'billing.plan_changed',
      objectType: 'organization_billing_account',
      summary: `Updated billing plan to ${plan}`
    });
    return Response.json({ ok: true, billing });
  } catch (error) {
    return apiErrorResponse(error, 'Billing update failed', { fallbackStatus: 402 });
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
  const body = (await readJsonRecord(request)) ?? {};
  const label = readRequiredString(body, 'label');
  if (!label) {
    return Response.json({ error: 'label is required' }, { status: 400 });
  }

  const actor = await resolveApiActorContext(request);
  requireApiRole(actor, ORG_ADMIN_ROLES);
  const apiKey = await createOrganizationApiKey({
    organizationId: actor.organizationId,
    createdById: actor.profileId,
    label
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
  requireApiRole(actor, ORG_ADMIN_ROLES);
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

export async function handleWorkspaceMembersInvitePost(request: Request) {
  const body = (await readJsonRecord(request)) ?? {};
  const email = readRequiredString(body, 'email');
  const role = readOptionalString(body, 'role');

  if (!email) {
    return Response.json({ error: 'email is required' }, { status: 400 });
  }

  const actor = await resolveApiActorContext(request);
  requireApiRole(actor, ORG_ADMIN_ROLES);

  try {
    const invitation = await createOrganizationInvitation({
      organizationId: actor.organizationId,
      invitedById: actor.profileId,
      email,
      role: role === 'owner' || role === 'admin' || role === 'viewer' || role === 'billing' ? role : 'member'
    });

    await createOrganizationNotifications({
      organizationId: actor.organizationId,
      kind: 'member_invited',
      title: 'Member invitation sent',
      body: `${email} was invited as ${role ?? 'member'}.`,
      metadata: {
        invitationId: invitation.invitation.id,
        invitedEmail: email,
        invitedRole: role ?? 'member'
      }
    });

    return Response.json({ ok: true, ...invitation });
  } catch (error) {
    if (error instanceof EntitlementError) {
      return Response.json(
        { error: 'Plan limit reached.', code: error.code },
        { status: error.status }
      );
    }
    throw error;
  }
}
