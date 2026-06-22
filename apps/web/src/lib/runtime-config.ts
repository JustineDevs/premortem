function isLoopbackHostname(hostname: string) {
  return hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '[::1]';
}

function canonicalLoopbackHostname(hostname: string) {
  if (hostname === 'localhost' || hostname === '[::1]') {
    return '127.0.0.1';
  }
  return hostname;
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

/** Stable origin for browser-auth redirects. Prefer the live request origin to preserve session cookies. */
export function getPublicAppOrigin(requestOrigin?: string): string {
  if (requestOrigin) {
    return requestOrigin;
  }
  const configured = process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (configured) {
    try {
      return new URL(configured).origin;
    } catch {
      return configured.replace(/\/$/, '');
    }
  }
  return 'http://127.0.0.1:13000';
}

/**
 * Canonical loopback origin for OAuth and integration handoffs.
 *
 * Local auth flows must keep a single host so cookies, redirect URIs, and
 * callback exchanges stay bound to the same origin.
 */
export function getCanonicalLoopbackOrigin(requestOrigin?: string): string | null {
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
