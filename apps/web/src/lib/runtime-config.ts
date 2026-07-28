function isLoopbackHostname(hostname: string) {
  return hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '[::1]';
}

function canonicalLoopbackHostname(hostname: string) {
  if (hostname === 'localhost' || hostname === '[::1]') {
    return '127.0.0.1';
  }
  return hostname;
}

function parseOriginCandidate(candidate: string | undefined | null): URL | null {
  if (!candidate) {
    return null;
  }

  try {
    return new URL(candidate);
  } catch {
    return null;
  }
}

function isLoopbackOrigin(candidate: string | undefined | null): boolean {
  const url = parseOriginCandidate(candidate);
  return Boolean(url && isLoopbackHostname(url.hostname));
}

export function getDeploymentEnvironment(): 'production' | 'preview' | 'development' {
  const vercelEnv = process.env.VERCEL_ENV?.trim();
  if (vercelEnv === 'production' || vercelEnv === 'preview' || vercelEnv === 'development') {
    return vercelEnv;
  }

  return process.env.NODE_ENV === 'production' ? 'production' : 'development';
}

export function getVercelDeploymentOrigin(): string | null {
  const vercelUrl = process.env.VERCEL_URL?.trim();
  if (!vercelUrl) {
    return null;
  }

  try {
    const url = vercelUrl.startsWith('http') ? new URL(vercelUrl) : new URL(`https://${vercelUrl}`);
    return url.origin;
  } catch {
    return null;
  }
}

export function getRequestOrigin(request: { headers: Headers; url: string }): string {
  const forwardedHost = request.headers.get('x-forwarded-host')?.split(',')[0]?.trim();
  const host = forwardedHost || request.headers.get('host')?.trim();
  if (host) {
    const forwardedProto = request.headers.get('x-forwarded-proto')?.split(',')[0]?.trim();
    const protocol = forwardedProto && forwardedProto.length > 0 ? forwardedProto : new URL(request.url).protocol.replace(/:$/, '');
    return `${protocol}://${host}`;
  }

  return new URL(request.url).origin;
}

export function getApiBaseUrl() {
  const deploymentEnvironment = getDeploymentEnvironment();
  const configured = process.env.PREMORTEM_API_BASE_URL?.trim();
  if (configured) {
    try {
      const url = new URL(configured);
      if (!isLoopbackHostname(url.hostname) || deploymentEnvironment === 'development') {
        return url.origin;
      }
    } catch {
      if (deploymentEnvironment === 'development') {
        return configured.replace(/\/$/, '');
      }
    }

    if (deploymentEnvironment === 'preview') {
      throw new Error('PREMORTEM_API_BASE_URL must not resolve to localhost in preview deployments.');
    }

    if (deploymentEnvironment === 'production') {
      return 'https://api.jstn.site';
    }
  }
  if (deploymentEnvironment === 'preview') {
    throw new Error('PREMORTEM_API_BASE_URL is required for Vercel preview deployments.');
  }

  if (deploymentEnvironment === 'production') {
    const fallback = process.env.NEXT_PUBLIC_APP_URL?.trim();
    if (fallback) {
      try {
        const url = new URL(fallback);
        if (url.hostname.startsWith('premortem.')) {
          return 'https://api.jstn.site';
        }
      } catch {
        // fall through to the canonical backend URL below
      }
    }

    return 'https://api.jstn.site';
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

/** Stable origin for browser-auth redirects. Prefer the live request origin to preserve session cookies. */
export function getPublicAppOrigin(requestOrigin?: string): string {
  const configured = process.env.NEXT_PUBLIC_APP_URL?.trim();
  const deploymentEnvironment = getDeploymentEnvironment();

  if (deploymentEnvironment !== 'development') {
    if (requestOrigin && !isLoopbackOrigin(requestOrigin)) {
      return requestOrigin;
    }

    if (configured && !isLoopbackOrigin(configured)) {
      try {
        return new URL(configured).origin;
      } catch {
        return configured.replace(/\/$/, '');
      }
    }

    const vercelOrigin = getVercelDeploymentOrigin();
    if (vercelOrigin) {
      return vercelOrigin;
    }

    throw new Error('NEXT_PUBLIC_APP_URL is required for preview and production deployments.');
  }

  if (requestOrigin) {
    return requestOrigin;
  }

  if (configured) {
    try {
      return new URL(configured).origin;
    } catch {
      return configured.replace(/\/$/, '');
    }
  }
  const vercelOrigin = getVercelDeploymentOrigin();
  if (vercelOrigin) {
    return vercelOrigin;
  }

  return 'http://127.0.0.1:13000';
}

export function getCanonicalSiteOrigin(): string {
  const configured = process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (configured) {
    try {
      const url = new URL(configured);
      if (!isLoopbackHostname(url.hostname)) {
        return url.origin;
      }
    } catch {
      return configured.replace(/\/$/, '');
    }
  }

  const vercelOrigin = getVercelDeploymentOrigin();
  if (vercelOrigin) {
    return vercelOrigin;
  }

  const deploymentEnvironment = getDeploymentEnvironment();
  if (deploymentEnvironment === 'development') {
    return 'http://127.0.0.1:13000';
  }

  return 'https://premortem.jstn.site';
}

/**
 * Stable redirect origin for auth handoffs.
 *
 * In development, keep using the live request origin so local cookies and
 * callbacks remain on the same loopback host. In preview and production,
 * prefer the canonical external site origin so a stale or proxied localhost
 * host header cannot leak into OAuth redirects.
 */
export function getAuthRedirectOrigin(requestOrigin?: string): string {
  const deploymentEnvironment = getDeploymentEnvironment();

  if (deploymentEnvironment === 'development') {
    return getPublicAppOrigin(requestOrigin);
  }

  return getCanonicalSiteOrigin();
}

/**
 * Canonical loopback origin for OAuth and integration handoffs.
 *
 * Local auth flows must keep a single host so cookies, redirect URIs, and
 * callback exchanges stay bound to the same origin.
 */
export function getCanonicalLoopbackOrigin(requestOrigin?: string): string | null {
  if (getDeploymentEnvironment() !== 'development') {
    return null;
  }

  const candidate = requestOrigin ?? process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (!candidate) {
    return null;
  }

  try {
    const url = new URL(candidate);
    if (!isLoopbackHostname(url.hostname)) {
      return null;
    }

    const canonicalHostname = canonicalLoopbackHostname(url.hostname);
    if (canonicalHostname === url.hostname) {
      return null;
    }

    url.hostname = canonicalHostname;
    return url.origin;
  } catch {
    return null;
  }
}

export function gitlabOAuthRedirectUri(requestOrigin?: string): string {
  return `${getPublicAppOrigin(requestOrigin)}/api/integrations/callback/gitlab`;
}

export function getMcpUpstreamUrl(): string {
  const deploymentEnvironment = getDeploymentEnvironment();
  const configured = process.env.MCP_UPSTREAM_URL?.trim();
  if (configured) {
    try {
      const url = new URL(configured);
      if (!isLoopbackHostname(url.hostname) || deploymentEnvironment === 'development') {
        return url.origin + url.pathname.replace(/\/$/, '');
      }
    } catch {
      if (deploymentEnvironment === 'development') {
        return configured.replace(/\/$/, '');
      }
    }

    if (deploymentEnvironment === 'preview') {
      throw new Error('MCP_UPSTREAM_URL must not resolve to localhost in preview deployments.');
    }

    if (deploymentEnvironment === 'production') {
      return `${getApiBaseUrl()}/api/mcp`;
    }
  }

  return `${getApiBaseUrl()}/api/mcp`;
}
