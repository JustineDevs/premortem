const PRODUCTION_REQUIRED_ENV = [
  'DATABASE_URL',
  'SUPABASE_SERVICE_ROLE_KEY',
  'STRIPE_WEBHOOK_SECRET'
] as const;

const STRICT_OPTIONAL_ENV = [
  'AUTH_JWT_SECRET',
  'ENCRYPTION_KEY',
  'IDENTITY_HMAC_SECRET',
  'SENTRY_DSN'
] as const;

export function checkRequiredEnv(options?: { production?: boolean }): string[] {
  const production = options?.production ?? process.env.NODE_ENV === 'production';
  const required = production ? [...PRODUCTION_REQUIRED_ENV, ...STRICT_OPTIONAL_ENV] : [];
  return required.filter((key) => !process.env[key]?.trim());
}

export function assertRequiredEnv(options?: { production?: boolean }): void {
  const missing = checkRequiredEnv(options);
  if (missing.length > 0) {
    throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
  }
}

export function exitIfMissingRequiredEnv(options?: { production?: boolean }): void {
  const missing = checkRequiredEnv(options);
  if (missing.length > 0) {
    console.error('STRICT_STARTUP: missing env vars:', missing.join(', '));
    process.exit(1);
  }
}
