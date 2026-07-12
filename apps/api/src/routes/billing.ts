import { prisma } from '@premortem/db/client';

import {
  buildStripeClientReferenceId,
  buildStripePaymentLinkUrl,
  getStripeClient,
  resolveStripePriceId
} from '../lib/stripe';
import { resolveApiActorContext } from '../lib/request-context';

const BILLING_ROLES = ['owner', 'admin', 'billing', 'member'] as const;

export async function handleBillingCheckoutPost(request: Request) {
  try {
    const context = await resolveApiActorContext(request);
    if (!BILLING_ROLES.includes(context.role as (typeof BILLING_ROLES)[number])) {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    const plan = body.plan === 'team' || body.plan === 'scale' ? body.plan : 'pro';
    const interval = body.interval === 'yearly' ? 'yearly' : 'monthly';

    const organization = await prisma.organization.findUniqueOrThrow({
      where: { id: context.organizationId },
      include: { billingAccount: true }
    });

    const clientReferenceId = buildStripeClientReferenceId(organization.id, context.profileId);

    const redirectUrl = buildStripePaymentLinkUrl(plan, interval, {
      clientReferenceId,
      prefilledEmail: organization.billingEmail ?? context.email ?? undefined
    });
    if (redirectUrl) {
      return Response.json({
        url: redirectUrl,
        sessionId: null,
        source: 'payment_link'
      });
    }

    const stripe = getStripeClient();
    const priceId = resolveStripePriceId(plan, interval);
    if (!priceId) {
      return Response.json(
        { error: `Missing Stripe price for plan: ${plan} (${interval})` },
        { status: 400 }
      );
    }

    let customerId = organization.billingAccount?.stripeCustomerId ?? undefined;
    if (!customerId) {
      const customer = await stripe.customers.create({
        email: organization.billingEmail ?? context.email ?? undefined,
        metadata: {
          organizationId: organization.id,
          organizationSlug: organization.slug,
          profileId: context.profileId
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

    const origin = process.env.NEXT_PUBLIC_APP_URL?.trim();
    if (!origin) {
      throw new Error('NEXT_PUBLIC_APP_URL is required for Stripe Checkout redirect URLs.');
    }

    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      customer: customerId,
      line_items: [{ price: priceId, quantity: 1 }],
      client_reference_id: clientReferenceId,
      success_url: `${origin}/app?billing=success`,
      cancel_url: `${origin}/app?billing=cancelled`,
      metadata: {
        organizationId: organization.id,
        profileId: context.profileId,
        plan,
        interval
      },
      subscription_data: {
        metadata: {
          organizationId: organization.id,
          profileId: context.profileId,
          plan,
          interval
        }
      }
    });

    return Response.json({ url: session.url, sessionId: session.id });
  } catch (error) {
    const message =
      error instanceof Error ? String((error as { message?: unknown }).message ?? '') : '';
    if (message === 'Unauthorized') {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (/not configured/i.test(message)) {
      return Response.json({ error: 'Stripe is not configured' }, { status: 503 });
    }
    return Response.json({ error: error instanceof Error ? error.message : 'Checkout failed' }, { status: 502 });
  }
}

export async function handleBillingPortalPost(request: Request) {
  try {
    const stripe = getStripeClient();
    const context = await resolveApiActorContext(request);
    if (!BILLING_ROLES.includes(context.role as (typeof BILLING_ROLES)[number])) {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }

    const organization = await prisma.organization.findUniqueOrThrow({
      where: { id: context.organizationId },
      include: { billingAccount: true }
    });

    const customerId = organization.billingAccount?.stripeCustomerId;
    if (!customerId) {
      return Response.json(
        { error: 'Stripe customer not found for this organization' },
        { status: 404 }
      );
    }

    const origin = process.env.NEXT_PUBLIC_APP_URL?.trim();
    if (!origin) {
      return Response.json(
        { error: 'NEXT_PUBLIC_APP_URL is required to open the billing portal' },
        { status: 500 }
      );
    }

    const session = await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: `${origin}/app?billing=portal`
    });

    return Response.json({ url: session.url, sessionId: session.id });
  } catch (error) {
    const message =
      error instanceof Error ? String((error as { message?: unknown }).message ?? '') : '';
    if (message === 'Unauthorized') {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (/not configured/i.test(message)) {
      return Response.json({ error: 'Stripe is not configured' }, { status: 503 });
    }
    return Response.json({ error: error instanceof Error ? error.message : 'Billing portal failed' }, { status: 502 });
  }
}
