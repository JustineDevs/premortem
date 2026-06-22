import type { AppRole } from '@prisma/client';
import { type ProfileProvisionHints } from './workspace';
export declare function resolveActorOrganization(profileId: string, hintedOrganizationId?: string, profileHints?: ProfileProvisionHints): Promise<{
    organizationId: string;
    profileId: string;
    role: AppRole;
}>;
//# sourceMappingURL=actor-context.d.ts.map