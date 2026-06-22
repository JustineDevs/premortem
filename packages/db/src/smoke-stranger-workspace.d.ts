export interface StrangerSmokeWorkspace {
    profileId: string;
    organizationId: string;
    projectId: string;
    connectionId: string;
    externalProjectId: string;
    email: string;
}
/** Simulates stranger onboarding: personal workspace + OAuth token + enabled repo (smoke/CI only). */
export declare function provisionStrangerSmokeWorkspace(input: {
    gitlabAccessToken: string;
    externalProjectId?: string;
}): Promise<StrangerSmokeWorkspace>;
export declare function cleanupStrangerSmokeWorkspace(workspace: StrangerSmokeWorkspace): Promise<void>;
//# sourceMappingURL=smoke-stranger-workspace.d.ts.map