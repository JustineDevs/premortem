'use client';

import {
  useWorkspaceMutations,
  useWorkspaceQuery,
  useAuthStatusQuery,
  type OsAuthStatusQueryState
} from '@/hooks/use-os-console-data';

export function useWorkspace(options?: { authStatusQuery?: OsAuthStatusQueryState | null }) {
  const authStatusQuery = options?.authStatusQuery ?? useAuthStatusQuery();
  const query = useWorkspaceQuery({ authStatusQuery });
  const mutations = useWorkspaceMutations({ authStatusQuery });

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
    createSlackConnectSession: mutations.createSlackConnectSession,
    syncSlackConnection: mutations.syncSlackConnection,
    startCheckout: mutations.startCheckout,
    startBillingPortal: mutations.startBillingPortal,
    cancelSubscription: mutations.cancelSubscription,
    reconcileIssues: mutations.reconcileIssues,
    cancelAudit: mutations.cancelAudit,
    pauseAudit: mutations.pauseAudit,
    resumeAudit: mutations.resumeAudit,
    stopAllRuntime: mutations.stopAllRuntime,
    installSkill: mutations.installSkill
  };
}
