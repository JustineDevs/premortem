export interface DiagnosticAction {
  label: string;
  href: string;
}

export interface DiagnosticSummary {
  title: string;
  scope: string;
  likelyCause: string;
  remediation: string;
  detail?: string;
  action?: DiagnosticAction;
}

function normalizeMessage(message: string) {
  return message.trim();
}

export function buildOsDiagnostic(message: string, options?: { loginHref?: string }): DiagnosticSummary {
  const normalized = normalizeMessage(message);
  const loginHref = options?.loginHref ?? '/login?next=/app';

  if (normalized === 'Unauthorized') {
    return {
      title: 'Sign-in is required',
      scope: 'Authentication session',
      likelyCause: 'The browser session does not have a valid Supabase auth cookie.',
      remediation: 'Sign in again from the same browser session so the reviewer console can restore the session state.',
      action: { label: 'Sign in', href: loginHref }
    };
  }

  if (
    normalized.includes('Unable to exchange external code') ||
    normalized.includes('callback host did not match') ||
    normalized.includes('external code exchange failed')
  ) {
    return {
      title: 'Auth callback exchange failed',
      scope: 'OAuth callback and PKCE session handoff',
      likelyCause: 'The callback origin, redirect URI, or browser session cookie did not stay on one host.',
      remediation:
        'Retry the login flow from the same browser tab and keep the app origin and callback URI aligned with the configured local host.',
      detail: normalized,
      action: { label: 'Retry sign-in', href: loginHref }
    };
  }

  if (normalized.toLowerCase().includes('rate limit')) {
    return {
      title: 'Request throttling is active',
      scope: 'BFF or API read path',
      likelyCause: 'The runtime rejected the request because the per-actor limit was exceeded.',
      remediation: 'Wait briefly and retry. If this repeats, inspect the rate limiter binding and request volume.',
      detail: normalized
    };
  }

  if (normalized.toLowerCase().includes('failed to load')) {
    return {
      title: 'Console data failed to load',
      scope: 'Web BFF to API worker',
      likelyCause: 'The API worker returned an error or the actor context could not be resolved.',
      remediation: 'Check the API worker logs, then reload the page after the upstream route is healthy.',
      detail: normalized
    };
  }

  return {
    title: 'Reviewer console unavailable',
    scope: 'Application runtime',
    likelyCause: 'The page or one of its dependent API routes returned an unexpected error.',
    remediation:
      'Reload the page. If the issue persists, check the API worker, auth session, and recent deploy logs.',
    detail: normalized
  };
}
