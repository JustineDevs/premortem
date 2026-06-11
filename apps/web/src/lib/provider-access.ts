import type { WorkspaceIntegration } from '@/hooks/workspace-types';
import type { IntegrationProviderId } from '@/lib/integration-connect';

/** Sign-in identity only (e.g. Supabase GitLab login with read_user). */
export type ProviderAccessPhase = 'identity_only' | 'repository_access';

export interface ProviderAccessState {
  provider: IntegrationProviderId;
  phase: ProviderAccessPhase;
  integration: WorkspaceIntegration | null;
}

export function resolveGitLabAccessState(
  integrations: WorkspaceIntegration[] | undefined
): ProviderAccessState {
  const integration =
    integrations?.find(
      (item) => item.provider === 'gitlab' && item.status !== 'disconnected'
    ) ?? null;

  return {
    provider: 'gitlab',
    phase: integration ? 'repository_access' : 'identity_only',
    integration
  };
}

export function gitLabAccessSummary(phase: ProviderAccessPhase): string {
  if (phase === 'repository_access') {
    return 'Repository access is granted. Discovery and publish can use your GitLab token.';
  }
  return 'You are signed in with GitLab. Grant repository access once to discover projects and publish issues.';
}
