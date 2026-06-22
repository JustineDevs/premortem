import type { AppRole, InvitationStatus } from '@prisma/client';
export interface OrganizationInvitationSummary {
    id: string;
    organizationId: string;
    email: string;
    role: AppRole;
    token: string;
    status: InvitationStatus;
    invitedById: string;
    expiresAt: string;
    acceptedById: string | null;
    acceptedAt: string | null;
    createdAt: string;
    updatedAt: string;
}
export declare function createOrganizationInvitation(input: {
    organizationId: string;
    invitedById: string;
    email: string;
    role?: AppRole;
    expiresInDays?: number;
}): Promise<{
    invitation: OrganizationInvitationSummary;
}>;
export declare function getOrganizationInvitationByToken(token: string): Promise<{
    invitation: OrganizationInvitationSummary;
    organization: {
        id: string;
        name: string;
        slug: string;
    };
    invitedBy: {
        id: string;
        email: string | null;
        username: string | null;
        fullName: string | null;
    };
    acceptedBy: {
        id: string;
        email: string | null;
        username: string | null;
        fullName: string | null;
    } | null;
} | null>;
export declare function acceptOrganizationInvitation(input: {
    token: string;
    acceptedById: string;
    acceptedByEmail?: string | null;
}): Promise<{
    invitation: OrganizationInvitationSummary;
} | null>;
//# sourceMappingURL=organization-invitations.d.ts.map