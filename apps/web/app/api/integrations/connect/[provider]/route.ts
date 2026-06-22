import { NextResponse, type NextRequest } from 'next/server';

import { integrationConnectOptions, type IntegrationProviderId } from '@/lib/integration-connect';
import { integrationConnectHref } from '@/lib/integration-connect';
import { getPublicAppOrigin, getRequestOrigin } from '@/lib/runtime-config';

function safeNextPath(value: string | null) {
  if (!value || !value.startsWith('/') || value.startsWith('//')) return '/app?tab=settings';
  return value;
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ provider: string }> }
) {
  const { provider } = await params;
  const providerId = provider as IntegrationProviderId;
  const option = integrationConnectOptions.find((item) => item.id === providerId);

  if (!option) {
    return NextResponse.json({ error: 'Unsupported provider' }, { status: 400 });
  }

  const next = safeNextPath(request.nextUrl.searchParams.get('next'));
  const origin = getPublicAppOrigin(getRequestOrigin(request));

  if (option.status === 'coming_soon') {
    const redirectUrl = new URL(next, origin);
    redirectUrl.searchParams.set('integration_notice', 'coming_soon');
    redirectUrl.searchParams.set('integration_provider', providerId);
    return NextResponse.redirect(redirectUrl);
  }

  if (providerId === 'gitlab') {
    const params = new URLSearchParams({ next });
    if (request.nextUrl.searchParams.get('discover') === '1') {
      params.set('discover', '1');
    }
    return NextResponse.redirect(new URL(`/api/integrations/connect/gitlab?${params.toString()}`, origin));
  }

  return NextResponse.redirect(integrationConnectHref(providerId, next, origin));
}
