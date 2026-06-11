import { prisma } from '@premortem/db';
import { NextResponse } from 'next/server';
import type Stripe from 'stripe';

import { getStripeClient } from '@/lib/stripe';

function planFromMetadata(metadata: Stripe.Metadata | null | undefined): 'free' | 'pro' | 'team' | 'enterprise' {
  const raw = metadata?.plan;
  if (raw === 'pro' || raw === 'team' || raw === 'enterprise' || raw === 'free') return raw;
  return 'pro';
}

async function applySubscription(subscription: Stripe.Subscription) {
  const organizationId = subscription.metadata.organizationId;
  if (!organizationId) return;

  const plan = planFromMetadata(subscription.metadata);
  const periodStart = subscription.items.data[0]?.current_period_start;
  const periodEnd = subscription.items.data[0]?.current_period_end;

  await prisma.organization.update({
    where: { id: organizationId },
    data: { plan }
  });
  await prisma.organizationBillingAccount.upsert({
    where: { organizationId },
    update: {
      plan,
      stripeCustomerId: String(subscription.customer),
      stripeSubscriptionId: subscription.id,
      billingStatus: subscription.status,
      currentPeriodStart: periodStart ? new Date(periodStart * 1000) : undefined,
      currentPeriodEnd: periodEnd ? new Date(periodEnd * 1000) : undefined
    },
    create: {
      organizationId,
      plan,
      stripeCustomerId: String(subscription.customer),
      stripeSubscriptionId: subscription.id,
      billingStatus: subscription.status,
      currentPeriodStart: periodStart ? new Date(periodStart * 1000) : undefined,
      currentPeriodEnd: periodEnd ? new Date(periodEnd * 1000) : undefined
    }
  });
}

export async function POST(request: Request) {
  const stripe = getStripeClient();
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!stripe || !webhookSecret) {
    return NextResponse.json({ error: 'Stripe webhook is not configured' }, { status: 503 });
  }

  const signature = request.headers.get('stripe-signature');
  if (!signature) {
    return NextResponse.json({ error: 'Missing stripe-signature header' }, { status: 400 });
  }

  const payload = await request.text();

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(payload, signature, webhookSecret);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Invalid webhook signature' },
      { status: 400 }
    );
  }

  switch (event.type) {
    case 'checkout.session.completed': {
      const session = event.data.object as Stripe.Checkout.Session;
      if (session.subscription && session.metadata?.organizationId) {
        const subscription = await stripe.subscriptions.retrieve(String(session.subscription));
        await applySubscription(subscription);
      }
      break;
    }
    case 'customer.subscription.updated':
    case 'customer.subscription.created': {
      await applySubscription(event.data.object as Stripe.Subscription);
      break;
    }
    case 'customer.subscription.deleted': {
      const subscription = event.data.object as Stripe.Subscription;
      const organizationId = subscription.metadata.organizationId;
      if (organizationId) {
        await prisma.organization.update({
          where: { id: organizationId },
          data: { plan: 'free' }
        });
        await prisma.organizationBillingAccount.updateMany({
          where: { organizationId },
          data: {
            plan: 'free',
            billingStatus: 'canceled',
            stripeSubscriptionId: null
          }
        });
      }
      break;
    }
    default:
      break;
  }

  return NextResponse.json({ received: true });
}
