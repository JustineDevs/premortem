import { NextResponse, type NextRequest } from 'next/server';

import { integrationConnectOptions, type IntegrationProviderId } from '@/lib/integration-connect';
import { integrationConnectHref } from '@/lib/integration-connect';

function safeNextPath(value: string | null) {
  if (!value || !value.startsWith('/') || value.startsWith('//')) return '/app?tab=settings';
  return value;
}

export async function GET(
  request: NextRequest,
  { params }: { params: { provider: string } }
) {
  const provider = params.provider as IntegrationProviderId;
  const option = integrationConnectOptions.find((item) => item.id === provider);

  if (!option) {
    return NextResponse.json({ error: 'Unsupported provider' }, { status: 400 });
  }

  const next = safeNextPath(request.nextUrl.searchParams.get('next'));

  if (option.status === 'coming_soon') {
    const redirectUrl = new URL(next, request.url);
    redirectUrl.searchParams.set('integration_notice', 'coming_soon');
    redirectUrl.searchParams.set('integration_provider', provider);
    return NextResponse.redirect(redirectUrl);
  }

  if (provider === 'gitlab') {
    const params = new URLSearchParams({ next });
    if (request.nextUrl.searchParams.get('discover') === '1') {
      params.set('discover', '1');
    }
    return NextResponse.redirect(new URL(`/api/integrations/connect/gitlab?${params.toString()}`, request.url));
  }

  return NextResponse.redirect(integrationConnectHref(provider, next));
}
