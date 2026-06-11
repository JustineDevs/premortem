import Stripe from 'stripe';

let stripeClient: Stripe | null = null;

export function getStripeClient() {
  if (stripeClient) return stripeClient;

  const secretKey = process.env.STRIPE_SECRET_KEY;
  if (!secretKey) return null;

  stripeClient = new Stripe(secretKey, {
    apiVersion: '2026-05-27.dahlia'
  });
  return stripeClient;
}

export function isStripeConfigured() {
  return Boolean(process.env.STRIPE_SECRET_KEY && process.env.STRIPE_WEBHOOK_SECRET);
}

export function isStripeTestMode() {
  const key = process.env.STRIPE_SECRET_KEY;
  return typeof key === 'string' && key.startsWith('sk_test_');
}

export type BillingInterval = 'monthly' | 'yearly';
export type PaidPlan = 'pro' | 'team';

export function resolveStripePriceId(plan: PaidPlan, interval: BillingInterval = 'monthly') {
  if (interval === 'yearly') {
    return plan === 'pro' ? process.env.STRIPE_PRICE_PRO_ANNUAL : process.env.STRIPE_PRICE_TEAM_ANNUAL;
  }

  return plan === 'pro' ? process.env.STRIPE_PRICE_PRO : process.env.STRIPE_PRICE_TEAM;
}

/** @deprecated Use resolveStripePriceId(plan, interval) */
export const STRIPE_PRICE_BY_PLAN: Record<PaidPlan, string | undefined> = {
  pro: process.env.STRIPE_PRICE_PRO,
  team: process.env.STRIPE_PRICE_TEAM
};
