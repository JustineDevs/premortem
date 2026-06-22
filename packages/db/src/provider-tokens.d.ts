export declare class GitLabTokenError extends Error {
    readonly code: 'gitlab_token_expired' | 'gitlab_reconnect_required';
    constructor(message: string, code?: 'gitlab_token_expired' | 'gitlab_reconnect_required');
}
export interface ResolvedGitLabCredentials {
    baseUrl: string;
    token: string;
    connectionId?: string;
    source: 'connection' | 'env';
}
export declare function decodeStoredToken(value: string): string;
export declare function encodeStoredToken(token: string): string;
/** Returns a live GitLab access token, refreshing OAuth credentials when needed. */
export declare function ensureGitLabAccessTokenForConnection(connectionId: string): Promise<string>;
export declare function resolveGitLabCredentialsForOrganization(organizationId: string, options?: {
    connectionId?: string;
}): Promise<ResolvedGitLabCredentials | null>;
export declare function resolveGitLabCredentialsForProject(projectId: string): Promise<ResolvedGitLabCredentials | null>;
export declare function storeProviderAccessToken(connectionId: string, token: string): Promise<{
    status: import("@prisma/client").$Enums.ConnectionStatus;
    updatedAt: Date;
    id: string;
    createdAt: Date;
    organizationId: string;
    provider: import("@prisma/client").$Enums.ProviderKind;
    externalAccountId: string | null;
    externalAccountName: string | null;
    installationRef: string | null;
    accessScope: import("@prisma/client/runtime/library").JsonValue;
    encryptedAccessToken: string | null;
    encryptedRefreshToken: string | null;
    tokenExpiresAt: Date | null;
    nangoConnectionId: string | null;
    nangoProviderKey: string | null;
    createdById: string;
    lastSyncedAt: Date | null;
}>;
export interface ResolvedGitHubCredentials {
    token: string;
    connectionId?: string;
    source: 'connection' | 'env';
}
export declare function resolveGitHubCredentialsForProject(projectId: string): Promise<ResolvedGitHubCredentials | null>;
//# sourceMappingURL=provider-tokens.d.ts.map