/** Stripe secret key is present (test or live sandbox). */
export declare function isStripeSecretConfigured(): boolean;
/** Standard Stripe test-mode key (`sk_test_...`). Checkout needs dashboard account name even here. */
export declare function isStripeTestMode(): boolean;
export declare function isStripePriceCatalogConfigured(): boolean;
/** Keys + webhook + prices are wired for billing integration. */
export declare function isStripeBillingConfigured(): boolean;
/**
 * Live Checkout flow. Test keys cannot update account profile via API and often
 * lack a dashboard business name, so local/hackathon upgrades use plan patch instead.
 */
export declare function shouldUseStripeCheckout(): boolean;
//# sourceMappingURL=stripe-env.d.ts.map