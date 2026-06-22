export interface OrganizationApiKeySummary {
    id: string;
    label: string;
    keyPrefix: string;
    lastUsedAt: Date | null;
    revokedAt: Date | null;
    createdAt: Date;
}
export interface OrganizationApiKeyVerification {
    organizationId: string;
    profileId: string;
    keyId: string;
    label: string;
}
export declare function listOrganizationApiKeys(organizationId: string): Promise<OrganizationApiKeySummary[]>;
export declare function createOrganizationApiKey(input: {
    organizationId: string;
    createdById: string;
    label: string;
}): Promise<{
    apiKey: string;
    key: OrganizationApiKeySummary;
}>;
export declare function revokeOrganizationApiKey(input: {
    organizationId: string;
    keyId: string;
}): Promise<import("@prisma/client").Prisma.BatchPayload>;
export declare function verifyOrganizationApiKey(token: string): Promise<OrganizationApiKeyVerification | null>;
//# sourceMappingURL=organization-api-keys.d.ts.map