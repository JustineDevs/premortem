export function buildSecurityHeaders(kind: 'api' | 'web' = 'api') {
  const common = {
    'x-content-type-options': 'nosniff',
    'referrer-policy': 'strict-origin-when-cross-origin',
    'permissions-policy': 'camera=(), microphone=(), geolocation=(), payment=()',
    'x-frame-options': 'DENY',
    'strict-transport-security': 'max-age=63072000; includeSubDomains; preload',
    'x-premortem-security': `hardened:${kind}`
  };

  if (kind === 'api') {
    return {
      ...common,
      'content-security-policy': "default-src 'none'; base-uri 'none'; frame-ancestors 'none'; form-action 'none'; img-src 'self' data:; style-src 'none'; script-src 'none'; connect-src 'none'"
    } satisfies Record<string, string>;
  }

  return {
    ...common,
    'content-security-policy':
      "default-src 'self'; base-uri 'self'; frame-ancestors 'self'; object-src 'none'; form-action 'self'; img-src 'self' data: blob: https:; style-src 'self' 'unsafe-inline'; script-src 'self' 'unsafe-inline' 'unsafe-eval' blob:; connect-src 'self' https: wss:; font-src 'self' data: https:; media-src 'self' blob:;"
  } satisfies Record<string, string>;
}
