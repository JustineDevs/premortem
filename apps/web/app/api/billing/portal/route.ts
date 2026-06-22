import { prisma } from '@premortem/db';
import { NextResponse } from 'next/server';

import { getStripeClient } from '@/lib/stripe';
import { bffErrorResponse } from '@/lib/server/bff-errors';
import { resolveRequestActorContext } from '@/lib/server/request-context';

const BILLING_ROLES = ['owner', 'admin'] as const;

export async function POST(request: Request) {
  const stripe = getStripeClient();
  if (!stripe) {
    return NextResponse.json({ error: 'Stripe is not configured' }, { status: 503 });
  }

  try {
    const context = await resolveRequestActorContext(request);
    if (!BILLING_ROLES.includes(context.role as (typeof BILLING_ROLES)[number])) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const organization = await prisma.organization.findUniqueOrThrow({
      where: { id: context.organizationId },
      include: { billingAccount: true }
    });

    const customerId = organization.billingAccount?.stripeCustomerId;
    if (!customerId) {
      return NextResponse.json(
        { error: 'Stripe customer not found for this organization' },
        { status: 404 }
      );
    }

    const origin =
      process.env.NEXT_PUBLIC_APP_URL ??
      process.env.NGROK_URL ??
      (process.env.NGROK_DOMAIN ? `https://${process.env.NGROK_DOMAIN}` : undefined) ??
      process.env.CORS_ORIGIN ??
      `http://localhost:${process.env.PREMORTEM_WEB_PORT ?? '13000'}`;

    const session = await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: `${origin}/app?billing=portal`
    });

    return NextResponse.json({ url: session.url, sessionId: session.id });
  } catch (error) {
    const message =
      error instanceof Error ? String((error as { message?: unknown }).message ?? '') : '';
    if (message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (/not configured/i.test(message)) {
      return NextResponse.json({ error: 'Stripe is not configured' }, { status: 503 });
    }
    return bffErrorResponse(error, 'Failed to open billing portal');
  }
}
