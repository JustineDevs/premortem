export interface SessionBoundary {
  actor: 'browser' | 'worker' | 'service';
  tokenType: 'anon' | 'session' | 'service-role' | 'provider-token';
  allowedScopes: string[];
}
