const TURNSTILE_SITEVERIFY_URL = 'https://challenges.cloudflare.com/turnstile/v0/siteverify';

export type TurnstileValidationResult =
  | { success: true }
  | {
      success: false;
      reason: 'missing-config' | 'missing-token' | 'verification-failed';
      errorCodes?: string[];
    };

export function isTurnstileEnabled(): boolean {
  return Boolean(process.env.TURNSTILE_SECRET_KEY?.trim());
}

export function isTurnstileConfigured(): boolean {
  return Boolean(
    process.env.TURNSTILE_SECRET_KEY?.trim() && process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY?.trim()
  );
}

export function getTurnstileSiteKey(): string | null {
  return process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY?.trim() ?? null;
}

export async function verifyTurnstileToken(
  token: string,
  request?: Request
): Promise<TurnstileValidationResult> {
  const secret = process.env.TURNSTILE_SECRET_KEY?.trim();
  if (!secret) {
    return { success: false, reason: 'missing-config' };
  }

  const responseToken = token.trim();
  if (!responseToken) {
    return { success: false, reason: 'missing-token' };
  }

  const body = new FormData();
  body.set('secret', secret);
  body.set('response', responseToken);

  const remoteIp = request?.headers.get('cf-connecting-ip')?.trim();
  if (remoteIp) {
    body.set('remoteip', remoteIp);
  }

  const response = await fetch(TURNSTILE_SITEVERIFY_URL, {
    method: 'POST',
    body
  });

  if (!response.ok) {
    return { success: false, reason: 'verification-failed' };
  }

  const payload = (await response.json().catch(() => null)) as
    | { success?: boolean; ['error-codes']?: string[] }
    | null;

  if (!payload?.success) {
    return {
      success: false,
      reason: 'verification-failed',
      errorCodes: payload?.['error-codes']
    };
  }

  return { success: true };
}
