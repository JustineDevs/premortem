import Stripe from 'stripe';

import { isStripeTestMode } from '@/lib/stripe';

export function mapStripeCheckoutError(error: unknown): { message: string; status: number } {
  if (error instanceof Stripe.errors.StripeError) {
    if (/account or business name/i.test(error.message)) {
      if (isStripeTestMode()) {
        return {
          message:
            'Stripe test mode needs a display name before Checkout works. Open https://dashboard.stripe.com/test/settings/account and save a test business name, or change plans in Settings (test mode applies plan limits without Checkout).',
          status: 503
        };
      }

      return {
        message:
          'Stripe Checkout needs a business name on your account. Open https://dashboard.stripe.com/settings/account, save your account details, then retry.',
        status: 503
      };
    }

    return { message: error.message, status: 502 };
  }

  if (error instanceof Error) {
    return { message: error.message, status: 502 };
  }

  return { message: 'Checkout failed', status: 502 };
}
