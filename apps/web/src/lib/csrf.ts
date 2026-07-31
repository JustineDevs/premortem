import { NextResponse, type NextRequest } from 'next/server';

export const CSRF_COOKIE_NAME = 'premortem-csrf';
export const CSRF_HEADER_NAME = 'x-premortem-csrf';

function randomToken(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID().replace(/-/g, '');
  }

  const bytes = new Uint8Array(32);
  if (typeof crypto !== 'undefined' && typeof crypto.getRandomValues === 'function') {
    crypto.getRandomValues(bytes);
  } else {
    for (let index = 0; index < bytes.length; index += 1) {
      bytes[index] = Math.floor(Math.random() * 256);
    }
  }

  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
}

function readCookieValue(cookieHeader: string | null | undefined, name: string): string | null {
  if (!cookieHeader) return null;

  for (const segment of cookieHeader.split(';')) {
    const [rawName, ...rest] = segment.trim().split('=');
    if (rawName === name) {
      const value = rest.join('=').trim();
      return value.length > 0 ? decodeURIComponent(value) : '';
    }
  }

  return null;
}

export function readCsrfTokenFromRequest(request: Pick<Request, 'headers'>): string | null {
  return readCookieValue(request.headers.get('cookie'), CSRF_COOKIE_NAME);
}

export function readCsrfTokenFromDocument(): string | null {
  if (typeof document === 'undefined') return null;
  return readCookieValue(document.cookie, CSRF_COOKIE_NAME);
}

export function createCsrfToken(): string {
  return randomToken();
}

export function browserSecurityRequestInit(init?: RequestInit): RequestInit {
  const headers = new Headers(init?.headers ?? {});
  const csrfToken = readCsrfTokenFromDocument();
  if (csrfToken) {
    headers.set(CSRF_HEADER_NAME, csrfToken);
  }

  return {
    ...init,
    credentials: init?.credentials ?? 'include',
    headers
  };
}

export async function browserSecurityFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  return fetch(input, browserSecurityRequestInit(init));
}

function secureCookieOptions(isProduction: boolean) {
  return {
    httpOnly: false,
    sameSite: 'lax' as const,
    secure: isProduction,
    path: '/',
    maxAge: 60 * 60 * 24 * 30
  };
}

export function ensureCsrfCookie<T extends NextResponse>(
  response: T,
  request: Pick<Request, 'headers' | 'url'>
): T {
  const existing = readCsrfTokenFromRequest(request);
  const token = existing ?? createCsrfToken();
  if (!existing) {
    response.cookies.set(CSRF_COOKIE_NAME, token, secureCookieOptions(new URL(request.url).protocol === 'https:'));
  }
  return response;
}

export function assertValidCsrfRequest(request: Request): { passed: boolean; reason?: string } {
  const method = request.method.toUpperCase();
  if (method === 'GET' || method === 'HEAD' || method === 'OPTIONS') {
    return { passed: true };
  }

  const cookieToken = readCsrfTokenFromRequest(request);
  const headerToken = request.headers.get(CSRF_HEADER_NAME)?.trim() ?? '';
  if (!cookieToken || !headerToken) {
    return { passed: false, reason: 'Missing CSRF token' };
  }

  if (cookieToken.length !== headerToken.length) {
    return { passed: false, reason: 'Invalid CSRF token' };
  }

  let diff = 0;
  for (let index = 0; index < cookieToken.length; index += 1) {
    diff |= cookieToken.charCodeAt(index) ^ headerToken.charCodeAt(index);
  }

  return diff === 0 ? { passed: true } : { passed: false, reason: 'Invalid CSRF token' };
}
