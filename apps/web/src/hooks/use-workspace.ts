'use client';

import { useWorkspaceMutations, useWorkspaceQuery } from '@/hooks/use-os-console-data';

export type { WorkspaceIntegration, WorkspaceBundle } from '@/hooks/workspace-types';

export function useWorkspace() {
  const query = useWorkspaceQuery();
  const mutations = useWorkspaceMutations();

  return {
    workspace: query.data ?? null,
    isLoading: query.isLoading,
    error: query.error instanceof Error ? query.error.message : query.error ? 'Failed to load workspace.' : null,
    reload: () => query.refetch(),
    patchPolicies: mutations.patchPolicies,
    patchRuntime: mutations.patchRuntime,
    patchWorkItemAttributes: mutations.patchWorkItemAttributes,
    patchNotifications: mutations.patchNotifications,
    patchLlm: mutations.patchLlm,
    patchProfile: mutations.patchProfile,
    patchOrganization: mutations.patchOrganization,
    patchBillingPlan: mutations.patchBillingPlan,
    createApiKey: mutations.createApiKey,
    revokeApiKey: mutations.revokeApiKey,
    registerIntegration: mutations.registerIntegration,
    syncIntegration: mutations.syncIntegration,
    startCheckout: mutations.startCheckout,
    reconcileIssues: mutations.reconcileIssues,
    cancelAudit: mutations.cancelAudit,
    pauseAudit: mutations.pauseAudit,
    resumeAudit: mutations.resumeAudit,
    stopAllRuntime: mutations.stopAllRuntime
  };
}
