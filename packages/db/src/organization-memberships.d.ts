import type { AppRole } from '@prisma/client';
export declare function getOrganizationMembershipRole(input: {
    organizationId: string;
    userId: string;
}): Promise<AppRole | null>;
export declare function setOrganizationMembershipRole(input: {
    organizationId: string;
    userId: string;
    role: AppRole;
    fromRoles?: AppRole[];
}): Promise<boolean>;
export declare function assertOrganizationSeatAvailability(input: {
    organizationId: string;
    userId?: string;
}): Promise<{
    seats: number;
    membershipCount: number;
    available: boolean;
}>;
//# sourceMappingURL=organization-memberships.d.ts.map
