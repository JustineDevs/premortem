import { type GitLabDiscoveredProject } from '@premortem/integrations';
import type { Prisma } from '@prisma/client';
import { GitLabTokenError } from './provider-tokens';
export type DiscoveredRepositoryRow = GitLabDiscoveredProject & {
    enabled: boolean;
    projectId: string | null;
    source: 'discovered' | 'public_watch' | 'manual';
};
export { GitLabTokenError };
export declare function listDiscoveredRepositories(input: {
    organizationId: string;
    connectionId: string;
}): Promise<{
    repositories: DiscoveredRepositoryRow[];
    lastSyncedAt: string | null;
}>;
export declare function enableDiscoveredRepositories(input: {
    organizationId: string;
    connectionId: string;
    externalProjectIds: string[];
    createdById?: string;
}): Promise<{
    enabled: {
        id: string;
        externalProjectId: string;
        name: string;
    }[];
    errors: {
        externalProjectId: string;
        error: string;
        code?: string;
    }[];
}>;
export declare function disableOrganizationProject(input: {
    organizationId: string;
    projectId: string;
}): Promise<{
    status: import("@prisma/client").$Enums.ProjectStatus;
    updatedAt: Date;
    id: string;
    name: string;
    createdAt: Date;
    connectionId: string | null;
    organizationId: string;
    provider: import("@prisma/client").$Enums.ProviderKind;
    createdById: string | null;
    slug: string;
    metadata: Prisma.JsonValue;
    externalProjectId: string;
    namespace: string | null;
    repoUrl: string | null;
    defaultBranch: string | null;
    visibility: string | null;
    settings: Prisma.JsonValue;
    connectedAt: Date | null;
}>;
export declare function registerPublicGitLabProject(input: {
    organizationId: string;
    repoUrlOrPath: string;
    createdById?: string;
}): Promise<{
    status: import("@prisma/client").$Enums.ProjectStatus;
    updatedAt: Date;
    id: string;
    name: string;
    createdAt: Date;
    connectionId: string | null;
    organizationId: string;
    provider: import("@prisma/client").$Enums.ProviderKind;
    createdById: string | null;
    slug: string;
    metadata: Prisma.JsonValue;
    externalProjectId: string;
    namespace: string | null;
    repoUrl: string | null;
    defaultBranch: string | null;
    visibility: string | null;
    settings: Prisma.JsonValue;
    connectedAt: Date | null;
}>;
//# sourceMappingURL=repository-discovery.d.ts.map