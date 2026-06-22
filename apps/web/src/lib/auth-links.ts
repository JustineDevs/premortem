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

export function authProviderHref(
  provider: AuthProvider,
  mode: AuthMode,
  next: string = authLinks.defaultNext,
  requestOrigin?: string
): string {
  const params = new URLSearchParams({ mode, next });
  const path = `/api/auth/${provider}?${params.toString()}`;
  if (requestOrigin) {
    try {
      return `${new URL(requestOrigin).origin}${path}`;
    } catch {
      return `${requestOrigin.replace(/\/$/, '')}${path}`;
    }
  }
  return path;
}
