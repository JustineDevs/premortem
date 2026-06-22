import type { Prisma } from '@prisma/client';
import { normalizeWorkItemAttributeConfig } from '@premortem/domain';
export declare const DEFAULT_WORKSPACE_POLICIES: readonly [{
    readonly id: "transport-ssl";
    readonly name: "Strict Transport Isolation (SSL)";
    readonly description: "Reject raw port 80 or unencrypted plaintext transit connections during live routing.";
    readonly active: true;
}, {
    readonly id: "env-fallback-literals";
    readonly name: "Reject environment fallback literals";
    readonly description: "Flag hardcoded access ids or keys fallback properties on module dependencies configuration.";
    readonly active: true;
}, {
    readonly id: "sql-parameterization";
    readonly name: "Strict parameters SQL verification";
    readonly description: "Prevent raw queries string concatenations on database router configurations.";
    readonly active: true;
}, {
    readonly id: "mask-sensitive-logs";
    readonly name: "Mask sensitive prints logs targets";
    readonly description: "Inhibit standard console print buffers output on critical credentials transaction requests.";
    readonly active: false;
}];
/** Active provider OAuth connection with a stored access token (repo/API scope). */
export declare function hasActiveProviderConnection(organizationId: string, provider: 'gitlab' | 'github'): Promise<boolean>;
export declare function readNotifications(metadata: Prisma.JsonValue): {
    slackWebhook: string;
    slackChannel: string;
    isSlackConnected: boolean;
    alertEmails: string;
    alertSeverity: string;
    slackNangoConnectionId: string;
    slackNangoProviderKey: string;
};
declare function readLlm(metadata: Prisma.JsonValue): {
    selectedGeminiModel: string;
    maxTokens: number;
    temperature: number;
    customProviders: Array<{
        name: string;
        host: string;
        model: string;
        active: boolean;
    }>;
    vendorRouting: ({
        id: string;
        label: string;
        description: string;
        kind: "custom";
        providerRef: string;
        enabled: boolean;
    } | {
        id: string;
        label: string;
        description: string;
        kind: "managed";
        providerRef: string;
        enabled: boolean;
    } | {
        id: string;
        label: string;
        description: string;
        kind: "auto_discover";
        providerRef: string;
        enabled: boolean;
    })[];
};
export type OrganizationLlmSettings = ReturnType<typeof readLlm>;
export declare function getOrganizationLlmSettings(organizationId: string): Promise<{
    selectedGeminiModel: string;
    maxTokens: number;
    temperature: number;
    customProviders: Array<{
        name: string;
        host: string;
        model: string;
        active: boolean;
    }>;
    vendorRouting: ({
        id: string;
        label: string;
        description: string;
        kind: "custom";
        providerRef: string;
        enabled: boolean;
    } | {
        id: string;
        label: string;
        description: string;
        kind: "managed";
        providerRef: string;
        enabled: boolean;
    } | {
        id: string;
        label: string;
        description: string;
        kind: "auto_discover";
        providerRef: string;
        enabled: boolean;
    })[];
}>;
export interface ProfileProvisionHints {
    email?: string | null;
    fullName?: string | null;
    username?: string | null;
}
export declare function createPersonalWorkspaceForProfile(profileId: string, hints?: ProfileProvisionHints): Promise<string>;
export declare function ensureProfileMembership(input: {
    profileId: string;
    email?: string | null;
    fullName?: string | null;
    username?: string | null;
    organizationId: string;
    role?: 'owner' | 'admin' | 'member' | 'viewer' | 'billing';
}): Promise<void>;
export declare function markProfileOnboardingCompleted(profileId: string): Promise<{
    updatedAt: Date;
    id: string;
    createdAt: Date;
    email: string | null;
    username: string | null;
    fullName: string | null;
    avatarUrl: string | null;
    bio: string | null;
    timezone: string;
    onboardingCompleted: boolean;
    defaultOrgId: string | null;
    lastSeenAt: Date | null;
}>;
export declare function ensureOrganizationDefaults(organizationId: string): Promise<void>;
export declare function getWorkspaceBundle(input: {
    organizationId: string;
    profileId: string;
}): Promise<{
    profile: {
        id: string;
        email: string | null;
        username: string | null;
        fullName: string | null;
        avatarUrl: string | null;
        timezone: string;
        role: import("@prisma/client").$Enums.AppRole;
    };
    organization: {
        id: string;
        name: string;
        slug: string;
        plan: import("@prisma/client").$Enums.OrgPlan;
        billingEmail: string | null;
        websiteUrl: string | null;
        memberCount: number;
        projectCount: number;
    };
    integrations: ({
        id: string;
        name: string;
        provider: import("@prisma/client").$Enums.ProviderKind;
        status: "disconnected" | "connected" | "active_check";
        scope: string;
        lastSync: string | null;
        vcsOwner: string;
        projectCount: number;
    } | {
        id: string;
        name: string;
        provider: import("@prisma/client").$Enums.ProviderKind;
        status: string;
        scope: string;
        lastSync: string;
        vcsOwner: string;
        projectCount: number;
    })[];
    policies: {
        id: string;
        name: string;
        description: string;
        active: boolean;
    }[];
    notifications: {
        slackWebhook: string;
        slackChannel: string;
        isSlackConnected: boolean;
        alertEmails: string;
        alertSeverity: string;
        slackNangoConnectionId: string;
        slackNangoProviderKey: string;
    };
    llm: {
        selectedGeminiModel: string;
        maxTokens: number;
        temperature: number;
        customProviders: Array<{
            name: string;
            host: string;
            model: string;
            active: boolean;
        }>;
        vendorRouting: ({
            id: string;
            label: string;
            description: string;
            kind: "custom";
            providerRef: string;
            enabled: boolean;
        } | {
            id: string;
            label: string;
            description: string;
            kind: "managed";
            providerRef: string;
            enabled: boolean;
        } | {
            id: string;
            label: string;
            description: string;
            kind: "auto_discover";
            providerRef: string;
            enabled: boolean;
        })[];
    };
    workItemAttributes: import("@premortem/domain").WorkItemAttributeConfig;
    billing: {
        plan: import("@prisma/client").$Enums.OrgPlan;
        billingStatus: string;
        seats: number;
        auditQuotaMonthly: number;
        auditsUsedMonth: number;
        stripeConfigured: boolean;
        stripeTestMode: boolean;
        stripeBillingConfigured: boolean;
        canPublish: boolean;
        maxRepos: number;
        invoices: import("./stripe-invoices").StripeInvoiceSummary[];
    };
    apiKeys: {
        id: string;
        label: string;
        keyPrefix: string;
        lastUsedAt: string | null;
        revokedAt: string | null;
        createdAt: string;
    }[];
    usage: {
        scans: {
            used: number;
            limit: number;
        };
        repos: {
            used: number;
            limit: number;
        };
        tokens: {
            used: number;
            limit: number;
        };
        patches: {
            used: number;
            limit: number;
        };
    };
    activity: {
        id: string;
        summary: string;
        actor: string;
        createdAt: string;
    }[];
    runtime: {
        continuousAuditEnabled: boolean;
        runningAudits: number;
    };
}>;
export declare function updateWorkspaceProfile(input: {
    profileId: string;
    fullName?: string;
    username?: string;
    timezone?: string;
    bio?: string;
}): Promise<{
    updatedAt: Date;
    id: string;
    createdAt: Date;
    email: string | null;
    username: string | null;
    fullName: string | null;
    avatarUrl: string | null;
    bio: string | null;
    timezone: string;
    onboardingCompleted: boolean;
    defaultOrgId: string | null;
    lastSeenAt: Date | null;
}>;
export declare function updateWorkspaceOrganization(input: {
    organizationId: string;
    name?: string;
    billingEmail?: string;
    websiteUrl?: string;
}): Promise<{
    updatedAt: Date;
    id: string;
    websiteUrl: string | null;
    name: string;
    createdAt: Date;
    createdById: string;
    slug: string;
    logoUrl: string | null;
    plan: import("@prisma/client").$Enums.OrgPlan;
    billingEmail: string | null;
    metadata: Prisma.JsonValue;
}>;
export declare function updateWorkspacePolicies(input: {
    organizationId: string;
    policies: Array<{
        id: string;
        name: string;
        description: string;
        active: boolean;
    }>;
}): Promise<{
    updatedAt: Date;
    id: string;
    websiteUrl: string | null;
    name: string;
    createdAt: Date;
    createdById: string;
    slug: string;
    logoUrl: string | null;
    plan: import("@prisma/client").$Enums.OrgPlan;
    billingEmail: string | null;
    metadata: Prisma.JsonValue;
}>;
export declare function updateWorkspaceWorkItemAttributes(input: {
    organizationId: string;
    workItemAttributes: ReturnType<typeof normalizeWorkItemAttributeConfig>;
}): Promise<{
    updatedAt: Date;
    id: string;
    websiteUrl: string | null;
    name: string;
    createdAt: Date;
    createdById: string;
    slug: string;
    logoUrl: string | null;
    plan: import("@prisma/client").$Enums.OrgPlan;
    billingEmail: string | null;
    metadata: Prisma.JsonValue;
}>;
export declare function updateWorkspaceRuntime(input: {
    organizationId: string;
    continuousAuditEnabled: boolean;
}): Promise<{
    updatedProjects: number;
}>;
export declare function stopAllAuditRuntime(organizationId: string, reason?: string): Promise<{
    continuousAuditEnabled: boolean;
    cancelledCount: number;
    updatedProjects: number;
}>;
export declare function updateWorkspaceNotifications(input: {
    organizationId: string;
    notifications: {
        slackWebhook?: string;
        slackChannel?: string;
        isSlackConnected?: boolean;
        alertEmails?: string;
        alertSeverity?: string;
        slackNangoConnectionId?: string;
        slackNangoProviderKey?: string;
    };
}): Promise<{
    updatedAt: Date;
    id: string;
    websiteUrl: string | null;
    name: string;
    createdAt: Date;
    createdById: string;
    slug: string;
    logoUrl: string | null;
    plan: import("@prisma/client").$Enums.OrgPlan;
    billingEmail: string | null;
    metadata: Prisma.JsonValue;
}>;
export declare function updateWorkspaceLlm(input: {
    organizationId: string;
    llm: {
        selectedGeminiModel?: string;
        maxTokens?: number;
        temperature?: number;
        customProviders?: Array<{
            name: string;
            host: string;
            model: string;
            active: boolean;
        }>;
        vendorRouting?: Array<{
            id: string;
            label: string;
            description: string;
            kind: 'managed' | 'custom' | 'auto_discover';
            providerRef: string;
            enabled: boolean;
        }>;
    };
}): Promise<{
    updatedAt: Date;
    id: string;
    websiteUrl: string | null;
    name: string;
    createdAt: Date;
    createdById: string;
    slug: string;
    logoUrl: string | null;
    plan: import("@prisma/client").$Enums.OrgPlan;
    billingEmail: string | null;
    metadata: Prisma.JsonValue;
}>;
export declare function createProviderConnection(input: {
    organizationId: string;
    createdById: string;
    provider: 'gitlab' | 'github';
    externalAccountName: string;
    externalAccountId?: string;
    accessScope?: Record<string, unknown>;
    accessToken?: string;
    nangoConnectionId?: string;
    nangoProviderKey?: string;
}): Promise<{
    status: import("@prisma/client").$Enums.ConnectionStatus;
    updatedAt: Date;
    id: string;
    createdAt: Date;
    organizationId: string;
    provider: import("@prisma/client").$Enums.ProviderKind;
    externalAccountId: string | null;
    externalAccountName: string | null;
    installationRef: string | null;
    accessScope: Prisma.JsonValue;
    encryptedAccessToken: string | null;
    encryptedRefreshToken: string | null;
    tokenExpiresAt: Date | null;
    nangoConnectionId: string | null;
    nangoProviderKey: string | null;
    createdById: string;
    lastSyncedAt: Date | null;
}>;
export declare function upsertProviderConnectionFromOAuth(input: {
    organizationId: string;
    createdById: string;
    provider: 'gitlab' | 'github';
    externalAccountId: string;
    externalAccountName: string;
    accessToken: string;
    refreshToken?: string;
    accessScope?: Record<string, unknown>;
    expiresInSeconds?: number;
    nangoConnectionId?: string;
    nangoProviderKey?: string;
}): Promise<{
    status: import("@prisma/client").$Enums.ConnectionStatus;
    updatedAt: Date;
    id: string;
    createdAt: Date;
    organizationId: string;
    provider: import("@prisma/client").$Enums.ProviderKind;
    externalAccountId: string | null;
    externalAccountName: string | null;
    installationRef: string | null;
    accessScope: Prisma.JsonValue;
    encryptedAccessToken: string | null;
    encryptedRefreshToken: string | null;
    tokenExpiresAt: Date | null;
    nangoConnectionId: string | null;
    nangoProviderKey: string | null;
    createdById: string;
    lastSyncedAt: Date | null;
}>;
export declare function syncProviderConnection(connectionId: string): Promise<{
    status: import("@prisma/client").$Enums.ConnectionStatus;
    updatedAt: Date;
    id: string;
    createdAt: Date;
    organizationId: string;
    provider: import("@prisma/client").$Enums.ProviderKind;
    externalAccountId: string | null;
    externalAccountName: string | null;
    installationRef: string | null;
    accessScope: Prisma.JsonValue;
    encryptedAccessToken: string | null;
    encryptedRefreshToken: string | null;
    tokenExpiresAt: Date | null;
    nangoConnectionId: string | null;
    nangoProviderKey: string | null;
    createdById: string;
    lastSyncedAt: Date | null;
}>;
export declare function updateBillingPlan(input: {
    organizationId: string;
    plan: 'free' | 'pro' | 'team' | 'enterprise';
}): Promise<{
    updatedAt: Date;
    id: string;
    createdAt: Date;
    organizationId: string;
    plan: import("@prisma/client").$Enums.OrgPlan;
    stripeCustomerId: string | null;
    stripeSubscriptionId: string | null;
    seats: number;
    auditQuotaMonthly: number;
    auditsUsedMonth: number;
    billingStatus: string | null;
    currentPeriodStart: Date | null;
    currentPeriodEnd: Date | null;
}>;
export declare function archiveProjectsOverLimit(organizationId: string, maxRepos: number): Promise<{
    archivedCount: number;
}>;
export declare function recordActivityEvent(input: {
    organizationId: string;
    actorId?: string;
    eventType: string;
    objectType: string;
    summary: string;
    projectId?: string;
    objectId?: string;
}): Promise<{
    projectId: string | null;
    summary: string | null;
    id: string;
    createdAt: Date;
    organizationId: string;
    metadata: Prisma.JsonValue;
    eventType: string;
    actorId: string | null;
    objectType: string;
    objectId: string | null;
}>;
export declare function getOrganizationActivityEvents(organizationId: string, limit?: number): Promise<{
    id: string;
    organizationId: string;
    projectId: string | null;
    actorId: string | null;
    actorEmail: string | null;
    actorName: string | null;
    eventType: string;
    objectType: string;
    objectId: string | null;
    summary: string | null;
    metadata: Prisma.JsonValue;
    createdAt: string;
}[]>;
export {};
//# sourceMappingURL=workspace.d.ts.map