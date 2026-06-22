export type IntegrationProviderId =
  | "gitlab"
  | "github"
  | "bitbucket"
  | "azure-devops"
  | "gitea";

export interface IntegrationConnectOption {
  id: IntegrationProviderId;
  name: string;
  description: string;
  status: "available" | "coming_soon";
  scopes: string;
}

export const integrationConnectOptions: IntegrationConnectOption[] = [
  {
    id: "gitlab",
    name: "GitLab",
    description:
      "Authorize repository access, issue publish, and reconciliation sync.",
    status: "available",
    scopes: "read_user, api, read_repository",
  },
  {
    id: "github",
    name: "GitHub",
    description: "GitHub connector is not enabled in this build.",
    status: "coming_soon",
    scopes: "repo, read:user",
  },
  {
    id: "bitbucket",
    name: "Bitbucket",
    description: "Bitbucket connector is not enabled in this build.",
    status: "coming_soon",
    scopes: "repository, account",
  },
  {
    id: "azure-devops",
    name: "Azure DevOps",
    description: "Azure DevOps connector is not enabled in this build.",
    status: "coming_soon",
    scopes: "vso.code, vso.work",
  },
  {
    id: "gitea",
    name: "Gitea",
    description: "Gitea connector is not enabled in this build.",
    status: "coming_soon",
    scopes: "repo, user",
  },
];

export function integrationConnectHref(
  provider: IntegrationProviderId,
  returnTo = "/app",
  requestOrigin?: string,
): string {
  const params = new URLSearchParams({ next: returnTo });
  const path = `/api/integrations/connect/${provider}?${params.toString()}`;
  if (requestOrigin) {
    try {
      return `${new URL(requestOrigin).origin}${path}`;
    } catch {
      return `${requestOrigin.replace(/\/$/, "")}${path}`;
    }
  }
  return path;
}
