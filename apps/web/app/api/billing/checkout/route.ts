import { prisma } from '@premortem/db';
import { NextResponse } from 'next/server';

import { getStripeClient, resolveStripePriceId, type BillingInterval, type PaidPlan } from '@/lib/stripe';
import { mapStripeCheckoutError } from '@/lib/stripe-checkout-error';
import { resolveRequestActorContext } from '@/lib/server/request-context';
import { readJsonRecord, readOptionalStringLiteral } from '@/lib/server/request-body';

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
    const body = (await readJsonRecord(request)) ?? {};
    const plan = readOptionalStringLiteral(body, 'plan', ['pro', 'team'] as const) ?? 'pro';
    const interval = readOptionalStringLiteral(body, 'interval', ['monthly', 'yearly'] as const) ?? 'monthly';
    const priceId = resolveStripePriceId(plan, interval);

    if (!priceId) {
      return NextResponse.json(
        { error: `Missing Stripe price for plan: ${plan} (${interval})` },
        { status: 400 }
      );
    }

    const organization = await prisma.organization.findUniqueOrThrow({
      where: { id: context.organizationId },
      include: { billingAccount: true }
    });

    let customerId = organization.billingAccount?.stripeCustomerId ?? undefined;
    if (!customerId) {
      const customer = await stripe.customers.create({
        email: organization.billingEmail ?? context.email ?? undefined,
        metadata: {
          organizationId: organization.id,
          organizationSlug: organization.slug
        }
      });
      customerId = customer.id;
      await prisma.organizationBillingAccount.upsert({
        where: { organizationId: organization.id },
        update: { stripeCustomerId: customerId },
        create: {
          organizationId: organization.id,
          stripeCustomerId: customerId,
          plan: organization.plan
        }
      });
    }

    const origin =
      process.env.NEXT_PUBLIC_APP_URL ??
      process.env.NGROK_URL ??
      (process.env.NGROK_DOMAIN ? `https://${process.env.NGROK_DOMAIN}` : undefined) ??
      process.env.CORS_ORIGIN ??
      `http://localhost:${process.env.PREMORTEM_WEB_PORT ?? '13000'}`;
    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      customer: customerId,
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${origin}/app?billing=success`,
      cancel_url: `${origin}/app?billing=cancelled`,
      metadata: {
        organizationId: organization.id,
        plan,
        interval
      },
      subscription_data: {
        metadata: {
          organizationId: organization.id,
          plan,
          interval
        }
      }
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
    const mapped = mapStripeCheckoutError(error);
    return NextResponse.json({ error: mapped.message }, { status: mapped.status });
  }
}
