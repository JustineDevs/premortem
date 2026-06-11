import { NextResponse, type NextRequest } from 'next/server';

import { getPublicAppOrigin } from '@/lib/runtime-config';

function isLoopbackHostname(hostname: string) {
  return hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '[::1]';
}

function canonicalHostRedirect(request: NextRequest): NextResponse | null {
  const configuredOrigin = getPublicAppOrigin();
  const requestOrigin = request.nextUrl.origin;

  if (requestOrigin === configuredOrigin) {
    return null;
  }

  const configuredHost = new URL(configuredOrigin).hostname;
  const requestHost = request.nextUrl.hostname;

  if (isLoopbackHostname(configuredHost) && isLoopbackHostname(requestHost)) {
    return null;
  }

  const redirectUrl = new URL(`${request.nextUrl.pathname}${request.nextUrl.search}`, configuredOrigin);
  return NextResponse.redirect(redirectUrl);
}

export async function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname;

  if (pathname.startsWith('/api/integrations/')) {
    const hostRedirect = canonicalHostRedirect(request);
    if (hostRedirect) {
      return hostRedirect;
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/api/integrations/:path*']
};
