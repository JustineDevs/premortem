import Stripe from 'stripe';

let stripeClient: Stripe | null = null;

const DEFAULT_STRIPE_PAYMENT_LINKS = {
  pro: {
    monthly: 'https://buy.stripe.com/test_6oU00leB05ib2Fq7ar0Ny00',
    yearly: 'https://buy.stripe.com/test_aFa9AV9gGbGz3Ju1Q70Ny01'
  },
  team: {
    monthly: 'https://buy.stripe.com/test_3cI4gB0KadOH5RCamD0Ny03',
    yearly: 'https://buy.stripe.com/test_28E4gB78y6mf7ZKfGX0Ny02'
  },
  scale: {
    monthly: undefined,
    yearly: undefined
  }
} as const;

export function getStripeClient() {
  if (stripeClient) return stripeClient;

  const secretKey = process.env.STRIPE_SECRET_KEY;
  if (!secretKey) {
    throw new Error('Stripe is required. Set STRIPE_SECRET_KEY before loading billing routes.');
  }

  stripeClient = new Stripe(secretKey, {
    apiVersion: '2026-05-27.dahlia'
  });
  return stripeClient;
}

export type BillingInterval = 'monthly' | 'yearly';
export type PaidPlan = 'pro' | 'team' | 'scale';

export function buildStripeClientReferenceId(
  organizationId: string,
  profileId?: string | null
) {
  return profileId ? `${organizationId}:${profileId}` : organizationId;
}

export function parseStripeClientReferenceId(
  value?: string | null
): { organizationId: string; profileId: string | null } | null {
  const normalized = value?.trim();
  if (!normalized) return null;

  const [organizationId, ...profileParts] = normalized.split(':');
  if (!organizationId) return null;

  return {
    organizationId,
    profileId: profileParts.join(':') || null
  };
}

export function resolveStripePriceId(plan: PaidPlan, interval: BillingInterval = 'monthly') {
  if (interval === 'yearly') {
    if (plan === 'pro') return process.env.STRIPE_PRICE_PRO_ANNUAL;
    if (plan === 'team') return process.env.STRIPE_PRICE_TEAM_ANNUAL;
    return process.env.STRIPE_PRICE_SCALE_ANNUAL;
  }

  if (plan === 'pro') return process.env.STRIPE_PRICE_PRO;
  if (plan === 'team') return process.env.STRIPE_PRICE_TEAM;
  return process.env.STRIPE_PRICE_SCALE;
}

export function resolveStripePaymentLinkUrl(
  plan: PaidPlan,
  interval: BillingInterval = 'monthly'
): string | null {
  const envKey = `STRIPE_PAYMENT_LINK_${plan.toUpperCase()}_${interval.toUpperCase()}` as const;
  const configured = process.env[envKey]?.trim();
  if (configured) {
    return configured;
  }

  if (process.env.NODE_ENV === 'production') {
    return null;
  }

  return DEFAULT_STRIPE_PAYMENT_LINKS[plan][interval] ?? null;
}

export function buildStripePaymentLinkUrl(
  plan: PaidPlan,
  interval: BillingInterval = 'monthly',
  input?: { clientReferenceId?: string; prefilledEmail?: string | null }
): string | null {
  const rawUrl = resolveStripePaymentLinkUrl(plan, interval);
  if (!rawUrl) return null;

  const url = new URL(rawUrl);
  if (input?.clientReferenceId) {
    url.searchParams.set('client_reference_id', input.clientReferenceId);
  }
  if (input?.prefilledEmail) {
    url.searchParams.set('prefilled_email', input.prefilledEmail);
  }
  return url.toString();
}

export function resolvePaidPlanFromPriceId(
  priceId: string | null | undefined
): { plan: PaidPlan; interval: BillingInterval } | null {
  const normalized = priceId?.trim();
  if (!normalized) return null;

  if (normalized === process.env.STRIPE_PRICE_PRO) {
    return { plan: 'pro', interval: 'monthly' };
  }
  if (normalized === process.env.STRIPE_PRICE_PRO_ANNUAL) {
    return { plan: 'pro', interval: 'yearly' };
  }
  if (normalized === process.env.STRIPE_PRICE_TEAM) {
    return { plan: 'team', interval: 'monthly' };
  }
  if (normalized === process.env.STRIPE_PRICE_TEAM_ANNUAL) {
    return { plan: 'team', interval: 'yearly' };
  }
  if (normalized === process.env.STRIPE_PRICE_SCALE) {
    return { plan: 'scale', interval: 'monthly' };
  }
  if (normalized === process.env.STRIPE_PRICE_SCALE_ANNUAL) {
    return { plan: 'scale', interval: 'yearly' };
  }

  return null;
}
