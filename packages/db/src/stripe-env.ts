/** Stripe secret key is present (test or live sandbox). */
export function isStripeSecretConfigured() {
  return Boolean(process.env.STRIPE_SECRET_KEY);
}

/** Standard Stripe test-mode key (`sk_test_...`). Checkout needs dashboard account name even here. */
export function isStripeTestMode() {
  const key = process.env.STRIPE_SECRET_KEY;
  return typeof key === 'string' && key.startsWith('sk_test_');
}

export function isStripePriceCatalogConfigured() {
  return Boolean(
    process.env.STRIPE_PRICE_PRO &&
      process.env.STRIPE_PRICE_TEAM &&
      process.env.STRIPE_PRICE_PRO_ANNUAL &&
      process.env.STRIPE_PRICE_TEAM_ANNUAL
  );
}

/** Keys + webhook + prices are wired for billing integration. */
export function isStripeBillingConfigured() {
  return Boolean(
    isStripeSecretConfigured() &&
      process.env.STRIPE_WEBHOOK_SECRET &&
      process.env.STRIPE_PRICE_PRO &&
      process.env.STRIPE_PRICE_TEAM
  );
}

/**
 * Live Checkout flow. Test keys cannot update account profile via API and often
 * lack a dashboard business name, so local/hackathon upgrades use plan patch instead.
 */
export function shouldUseStripeCheckout() {
  return isStripeBillingConfigured() && !isStripeTestMode();
}
