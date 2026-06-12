function isLoopbackHostname(hostname: string) {
  return hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '[::1]';
}

export function getApiBaseUrl() {
  const configured = process.env.PREMORTEM_API_BASE_URL?.trim();
  if (configured) {
    return configured.replace(/\/$/, '');
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (appUrl) {
    try {
      const url = new URL(appUrl);
      if (!isLoopbackHostname(url.hostname)) {
        if (!url.hostname.startsWith('api.')) {
          url.hostname = `api.${url.hostname}`;
        }
        return url.origin;
      }
    } catch {
      // fall through to the local default below
    }
  }

  return 'http://127.0.0.1:18787';
}

/** Stable origin for OAuth redirect URIs (must match GitLab app callback URL exactly). */
export function getPublicAppOrigin(requestOrigin?: string): string {
  const configured = process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (configured) {
    try {
      return new URL(configured).origin;
    } catch {
      // fall through
    }
  }
  if (requestOrigin) {
    return requestOrigin;
  }
  return 'http://127.0.0.1:13000';
}

export function gitlabOAuthRedirectUri(requestOrigin?: string): string {
  return `${getPublicAppOrigin(requestOrigin)}/api/integrations/callback/gitlab`;
}
