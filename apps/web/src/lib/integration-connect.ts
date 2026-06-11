export type IntegrationProviderId = 'gitlab' | 'github' | 'bitbucket' | 'azure-devops' | 'gitea';

export interface IntegrationConnectOption {
  id: IntegrationProviderId;
  name: string;
  description: string;
  status: 'available' | 'coming_soon';
  scopes: string;
}

export const integrationConnectOptions: IntegrationConnectOption[] = [
  {
    id: 'gitlab',
    name: 'GitLab',
    description: 'Authorize repository access, issue publish, and reconciliation sync.',
    status: 'available',
    scopes: 'read_user, api, read_repository'
  },
  {
    id: 'github',
    name: 'GitHub',
    description: 'Connect orgs and repos for audit ingestion and issue sync.',
    status: 'coming_soon',
    scopes: 'repo, read:user'
  },
  {
    id: 'bitbucket',
    name: 'Bitbucket',
    description: 'Pipeline and repository context for Atlassian workspaces.',
    status: 'coming_soon',
    scopes: 'repository, account'
  },
  {
    id: 'azure-devops',
    name: 'Azure DevOps',
    description: 'Repos, pipelines, and work-item publish for Azure organizations.',
    status: 'coming_soon',
    scopes: 'vso.code, vso.work'
  },
  {
    id: 'gitea',
    name: 'Gitea',
    description: 'Self-hosted Git with Premortem audit and issue workflows.',
    status: 'coming_soon',
    scopes: 'repo, user'
  }
];

export function integrationConnectHref(provider: IntegrationProviderId, returnTo = '/app'): string {
  const params = new URLSearchParams({ next: returnTo });
  return `/api/integrations/connect/${provider}?${params.toString()}`;
}
