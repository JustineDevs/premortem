import { archiveProjectsOverLimit, recordActivityEvent } from '@premortem/db/activity';
import { PLAN_LIMITS } from '@premortem/db/entitlements';
import { prisma } from '@premortem/db/client';
import { createOrganizationNotifications } from '@premortem/db/notifications';
import type Stripe from 'stripe';

import { getStripeClient } from '../lib/stripe';
import { readJsonRecord, readOptionalString, readOptionalStringLiteral } from '../lib/request-body';
import { resolveApiActorContext } from '../lib/request-context';

const BILLING_ROLES = ['owner', 'admin', 'billing', 'member'] as const;

type SubscriptionCancelMode = 'period_end' | 'immediate';

type StripeInvoiceWithRefs = Stripe.Invoice & {
  payment_intent?: string | Stripe.PaymentIntent | null;
  charge?: string | Stripe.Charge | null;
};

type StripeSubscriptionWithPeriods = Stripe.Subscription & {
  latest_invoice?: Stripe.Invoice | string | null;
  current_period_start?: number | null;
  current_period_end?: number | null;
};

function toIsoDateTime(value: number | null | undefined): string | null {
  return value ? new Date(value * 1000).toISOString() : null;
}

function getSubscriptionInvoice(
  subscription: StripeSubscriptionWithPeriods
): StripeInvoiceWithRefs | null {
  const invoice = subscription.latest_invoice;
  if (!invoice || typeof invoice === 'string') return null;
  return invoice as StripeInvoiceWithRefs;
}

function getRefundablePaymentReference(invoice: StripeInvoiceWithRefs): string | null {
  if (typeof invoice.payment_intent === 'string') {
    return invoice.payment_intent;
  }
  if (invoice.payment_intent && typeof invoice.payment_intent === 'object') {
    return invoice.payment_intent.id;
  }
  if (typeof invoice.charge === 'string') {
    return invoice.charge;
  }
  if (invoice.charge && typeof invoice.charge === 'object') {
    return invoice.charge.id;
  }
  return null;
}

function calculateProratedRefundAmount(
  subscription: StripeSubscriptionWithPeriods,
  invoice: StripeInvoiceWithRefs
): number {
  const amountPaid = invoice.amount_paid ?? 0;
  if (amountPaid <= 0) return 0;

  const periodStart = subscription.items.data[0]?.current_period_start ?? 0;
  const periodEnd = subscription.items.data[0]?.current_period_end ?? 0;
  if (periodStart <= 0 || periodEnd <= 0 || periodEnd <= periodStart) {
    return amountPaid;
  }

  const now = Math.floor(Date.now() / 1000);
  const remaining = Math.max(periodEnd - now, 0);
  const total = Math.max(periodEnd - periodStart, 1);
  const proratedAmount = Math.round((amountPaid * remaining) / total);
  return Math.max(0, Math.min(amountPaid, proratedAmount));
}

async function resolveOrganizationSubscription(
  stripe: Stripe,
  customerId?: string | null,
  subscriptionId?: string | null
): Promise<StripeSubscriptionWithPeriods | null> {
  if (subscriptionId) {
    return stripe.subscriptions.retrieve(subscriptionId, {
      expand: ['latest_invoice']
    }) as Promise<StripeSubscriptionWithPeriods>;
  }

  if (!customerId) return null;

  const subscriptions = await stripe.subscriptions.list({
    customer: customerId,
    status: 'all',
    limit: 10
  });
  return (
    subscriptions.data.find(
      (subscription) =>
        subscription.status !== 'canceled' && subscription.status !== 'incomplete_expired'
    ) ?? null
  );
}

export async function handleBillingSubscriptionPost(request: Request) {
  try {
    const stripe = getStripeClient();
    const context = await resolveApiActorContext(request);
    if (!BILLING_ROLES.includes(context.role as (typeof BILLING_ROLES)[number])) {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = (await readJsonRecord(request)) ?? {};
    const mode =
      readOptionalStringLiteral(body, 'mode', ['period_end', 'immediate'] as const) ?? 'period_end';
    const refund = body.refund === true;
    const reason = readOptionalString(body, 'reason') ?? null;

    const organization = await prisma.organization.findUniqueOrThrow({
      where: { id: context.organizationId },
      include: { billingAccount: true }
    });

    const billingAccount = organization.billingAccount;
    if (!billingAccount?.stripeCustomerId) {
      return Response.json(
        { error: 'Stripe customer not found for this organization' },
        { status: 404 }
      );
    }

    const subscription = await resolveOrganizationSubscription(
      stripe,
      billingAccount.stripeCustomerId,
      billingAccount.stripeSubscriptionId
    );
    if (!subscription) {
      return Response.json(
        { error: 'Active subscription not found for this organization' },
        { status: 404 }
      );
    }

    const activePlan = organization.plan;
    const latestInvoice = getSubscriptionInvoice(subscription);
    let refundStatus: 'not_requested' | 'refunded' | 'not_available' | 'failed' = 'not_requested';
    let refundedAmount = 0;
    let refundId: string | null = null;

    if (mode === 'period_end') {
      const updated = (await stripe.subscriptions.update(subscription.id, {
        cancel_at_period_end: true
      })) as StripeSubscriptionWithPeriods;
      const updatedPeriodStart = updated.items.data[0]?.current_period_start ?? null;
      const updatedPeriodEnd = updated.items.data[0]?.current_period_end ?? null;

      await prisma.organizationBillingAccount.upsert({
        where: { organizationId: organization.id },
        update: {
          plan: activePlan,
          auditsUsedMonth: billingAccount.auditsUsedMonth,
          auditQuotaMonthly:
            billingAccount.auditQuotaMonthly ?? PLAN_LIMITS[activePlan].auditsPerMonth,
          billingStatus: 'canceling',
          stripeCustomerId: billingAccount.stripeCustomerId,
          stripeSubscriptionId: updated.id,
          currentPeriodStart: updatedPeriodStart
            ? new Date(updatedPeriodStart * 1000)
            : null,
          currentPeriodEnd: updatedPeriodEnd ? new Date(updatedPeriodEnd * 1000) : null
        },
        create: {
          organizationId: organization.id,
          plan: activePlan,
          auditsUsedMonth: billingAccount.auditsUsedMonth,
          auditQuotaMonthly:
            billingAccount.auditQuotaMonthly ?? PLAN_LIMITS[activePlan].auditsPerMonth,
          billingStatus: 'canceling',
          stripeCustomerId: billingAccount.stripeCustomerId,
          stripeSubscriptionId: updated.id,
          currentPeriodStart: updatedPeriodStart
            ? new Date(updatedPeriodStart * 1000)
            : null,
          currentPeriodEnd: updatedPeriodEnd ? new Date(updatedPeriodEnd * 1000) : null
        }
      });

      await createOrganizationNotifications({
        organizationId: organization.id,
        kind: 'billing_notice',
        title: 'Subscription scheduled to cancel',
        body: `Your ${activePlan} plan will end at the close of the current billing period.`,
        metadata: {
          event: 'subscription_cancel_scheduled',
          subscriptionId: subscription.id,
          reason
        }
      });

      await recordActivityEvent({
        organizationId: organization.id,
        actorId: context.profileId,
        eventType: 'billing.updated',
        objectType: 'organization',
        objectId: organization.id,
        summary: 'Scheduled subscription cancellation at period end'
      });

      return Response.json({
        ok: true,
        mode,
        billingStatus: 'canceling',
        currentPeriodEnd: toIsoDateTime(updatedPeriodEnd),
        refundedAmount,
        refundStatus
      });
    }

    const canceled = (await stripe.subscriptions.cancel(subscription.id, {
      invoice_now: false,
      prorate: false
    })) as StripeSubscriptionWithPeriods;

    if (refund) {
      if (!latestInvoice) {
        refundStatus = 'not_available';
      } else {
        const paymentReference = getRefundablePaymentReference(latestInvoice);
        const amount = calculateProratedRefundAmount(canceled, latestInvoice);
        if (!paymentReference || amount <= 0) {
          refundStatus = 'not_available';
        } else {
          try {
            const refundResult = await stripe.refunds.create(
              paymentReference.includes('pi_')
                ? { payment_intent: paymentReference, amount }
                : { charge: paymentReference, amount }
            );
            refundStatus = 'refunded';
            refundedAmount = refundResult.amount ?? amount;
            refundId = refundResult.id;
          } catch {
            refundStatus = 'failed';
          }
        }
      }
    }

    await prisma.organization.update({
      where: { id: organization.id },
      data: { plan: 'free' }
    });
    await prisma.organizationBillingAccount.upsert({
      where: { organizationId: organization.id },
      update: {
        plan: 'free',
        auditsUsedMonth: 0,
        auditQuotaMonthly: PLAN_LIMITS.free.auditsPerMonth,
        billingStatus: 'canceled',
        stripeCustomerId: billingAccount.stripeCustomerId,
        stripeSubscriptionId: null,
        currentPeriodStart: null,
        currentPeriodEnd: null
      },
      create: {
        organizationId: organization.id,
        plan: 'free',
        auditsUsedMonth: 0,
        auditQuotaMonthly: PLAN_LIMITS.free.auditsPerMonth,
        billingStatus: 'canceled',
        stripeCustomerId: billingAccount.stripeCustomerId,
        stripeSubscriptionId: null,
        currentPeriodStart: null,
        currentPeriodEnd: null
      }
    });

    await archiveProjectsOverLimit(organization.id, PLAN_LIMITS.free.maxRepos);
    await createOrganizationNotifications({
      organizationId: organization.id,
      kind: 'billing_notice',
      title: refundStatus === 'refunded' ? 'Subscription canceled and refunded' : 'Subscription canceled',
      body:
        refundStatus === 'refunded'
          ? `Your subscription was canceled and a refund of ${(refundedAmount / 100).toFixed(2)} was issued.`
          : refundStatus === 'failed'
            ? 'Your subscription was canceled, but the refund could not be processed automatically. Please review the Stripe dashboard.'
            : 'Your subscription was canceled and access has been moved back to the Free tier.',
      metadata: {
        event: 'subscription_canceled',
        subscriptionId: subscription.id,
        refundId,
        refundedAmount,
        refundStatus,
        reason
      }
    });

    await recordActivityEvent({
      organizationId: organization.id,
      actorId: context.profileId,
      eventType: 'billing.updated',
      objectType: 'organization',
      objectId: organization.id,
      summary: refundStatus === 'refunded' ? 'Canceled subscription with refund' : 'Canceled subscription'
    });

    return Response.json({
      ok: true,
      mode,
      billingStatus: 'canceled',
      refundedAmount,
      refundStatus
    });
  } catch (error) {
    const message =
      error instanceof Error ? String((error as { message?: unknown }).message ?? '') : '';
    if (message === 'Unauthorized') {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (/not configured/i.test(message)) {
      return Response.json({ error: 'Stripe is not configured' }, { status: 503 });
    }
    return Response.json({ error: 'Failed to update subscription' }, { status: 500 });
  }
}
