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
  next: string = authLinks.defaultNext
): string {
  const params = new URLSearchParams({ mode, next });
  return `/api/auth/${provider}?${params.toString()}`;
}
