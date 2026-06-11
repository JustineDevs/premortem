import {
  createProviderConnection,
  ensureProfileMembership,
  getWorkspaceBundle,
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
  return Response.json({ ok: true, ...result });
}

export async function handleWorkspaceRuntimeStopAll(request: Request) {
  const actor = await resolveApiActorContext(request);
  const result = await stopAllAuditRuntime(actor.organizationId);
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
  return Response.json({ ok: true });
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
      accessScope: body.accessScope
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
    return Response.json({ ok: true, billing });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : 'Billing update failed' },
      { status: 402 }
    );
  }
}
