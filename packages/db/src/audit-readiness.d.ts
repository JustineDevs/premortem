export declare class AuditReadinessError extends Error {
    readonly code: string;
    readonly field: string;
    readonly system: string;
    constructor(message: string, code: string, field: string, system?: string);
}
export declare function verifyGitLabRepoReadAccess(input: {
    baseUrl: string;
    token: string;
    externalProjectId: string;
}): Promise<{
    permissions?: {
        project_access?: {
            access_level?: number;
        };
        group_access?: {
            access_level?: number;
        };
    };
}>;
export declare function verifyGitLabIssueWriteAccess(input: {
    baseUrl: string;
    token: string;
    externalProjectId: string;
}): Promise<{
    permissions?: {
        project_access?: {
            access_level?: number;
        };
        group_access?: {
            access_level?: number;
        };
    };
}>;
/** Probes GitLab issue create + close on the target project (validates api scope, not just role). */
export declare function verifyGitLabIssueCreateAccess(input: {
    baseUrl: string;
    token: string;
    externalProjectId: string;
}): Promise<{
    iid?: number;
}>;
export declare function probeGitLabIssueWriteAccess(input: {
    baseUrl: string;
    token: string;
    externalProjectId: string;
}): Promise<boolean>;
export declare function canCreateGitLabIssues(input: {
    baseUrl: string;
    token: string;
    externalProjectId: string;
}): Promise<boolean>;
export declare function findPublishCapableGitLabTokenFromConnections(externalProjectId: string): Promise<{
    token: string;
    connectionId: string;
    externalAccountName: string | null;
} | null>;
/** Resolves a GitLab token that can publish issues for production stranger smoke. */
export declare function resolveSmokeGitLabPublishToken(input: {
    externalProjectId: string;
}): Promise<{
    token: string;
    source: "env";
    connectionId?: undefined;
    externalAccountName?: undefined;
} | {
    token: string;
    source: "connection";
    connectionId: string;
    externalAccountName: string | null;
}>;
/** Validates repo access when registering a GitLab project. */
export declare function verifyGitLabRegistrationAccess(input: {
    organizationId: string;
    repoUrl?: string;
    externalProjectId?: string;
    connectionId?: string;
    baseUrl?: string;
    token?: string;
    requireIssueWrite?: boolean;
}): Promise<void>;
/** Validates GitLab issue write/create access before publishing to GitLab. */
export declare function assertGitLabPublishReadiness(projectId: string): Promise<void>;
export declare function assertAuditReadiness(input: {
    organizationId: string;
    projectId: string;
}): Promise<void>;
//# sourceMappingURL=audit-readiness.d.ts.map