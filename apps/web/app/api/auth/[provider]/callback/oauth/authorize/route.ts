import { NextResponse, type NextRequest } from 'next/server';

import { type AuthProvider } from '@/lib/auth-links';

function redirectToGitLabAuthorize(request: NextRequest, provider: AuthProvider) {
  if (provider !== 'gitlab') {
    return NextResponse.json({ error: 'Unsupported provider' }, { status: 404 });
  }

  const baseUrl = process.env.GITLAB_BASE_URL?.trim() || 'https://gitlab.com';
  const target = new URL('/oauth/authorize', baseUrl.replace(/\/$/, ''));
  target.search = request.nextUrl.search;
  return NextResponse.redirect(target, 303);
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ provider: string }> }
) {
  const { provider } = await params;
  return redirectToGitLabAuthorize(request, provider as AuthProvider);
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ provider: string }> }
) {
  const { provider } = await params;
  return redirectToGitLabAuthorize(request, provider as AuthProvider);
}
