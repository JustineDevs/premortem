export type AuthMode = 'signup' | 'login';

export type AuthProvider = 'gitlab' | 'github';

export const authLinks = {
  signup: '/signup',
  login: '/login',
  forgotPassword: '/forgot-password',
  resetPassword: '/reset-password',
  callback: '/auth/callback',
  defaultNext: '/app',
  logout: '/api/auth/logout'
} as const;

function isLoopbackHostname(hostname: string) {
  return hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '[::1]';
}

export function getCanonicalBrowserAppOrigin(): string | null {
  const configuredSiteUrl = process.env.PREMORTEM_SITE_URL?.trim();
  const configuredAppUrl = process.env.NEXT_PUBLIC_APP_URL?.trim();

  for (const candidate of [configuredSiteUrl, configuredAppUrl]) {
    if (!candidate) continue;
    try {
      const url = new URL(candidate);
      if (!isLoopbackHostname(url.hostname)) {
        return url.origin;
      }
    } catch {
      if (process.env.NODE_ENV !== 'development' && !candidate.includes('localhost')) {
        return candidate.replace(/\/$/, '');
      }
    }
  }

  if (process.env.NODE_ENV === 'development') {
    if (typeof window !== 'undefined') {
      return window.location.origin;
    }

    return configuredAppUrl ? configuredAppUrl.replace(/\/$/, '') : null;
  }

  return 'https://premortem.jstn.site';
}

export function authProviderHref(
  provider: AuthProvider,
  mode: AuthMode,
  next: string = authLinks.defaultNext,
  requestOrigin?: string
): string {
  const params = new URLSearchParams({ mode, next });
  const path = `/api/auth/${provider}?${params.toString()}`;
  const origin = requestOrigin ?? getCanonicalBrowserAppOrigin();

  if (origin) {
    try {
      return `${new URL(origin).origin}${path}`;
    } catch {
      return `${origin.replace(/\/$/, '')}${path}`;
    }
  }
  return path;
}
