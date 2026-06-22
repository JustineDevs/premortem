export interface StripeInvoiceSummary {
  id: string;
  date: string;
  amount: number;
  status: string;
  method: string;
  hostedInvoiceUrl: string | null;
  invoicePdfUrl: string | null;
}

function resolveStripeSecretKey() {
  const key = process.env.STRIPE_SECRET_KEY?.trim();
  return key || null;
}

function asIntegerCents(value: unknown): number {
  if (typeof value === 'number') return Math.round(value);
  if (typeof value === 'string') return Math.round(Number.parseFloat(value));
  return 0;
}

export async function listStripeInvoicesForCustomer(
  customerId: string,
  limit = 10
): Promise<StripeInvoiceSummary[]> {
  const secretKey = resolveStripeSecretKey();
  if (!secretKey) return [];
  if (!customerId.trim()) return [];

  const url = new URL('https://api.stripe.com/v1/invoices');
  url.searchParams.set('customer', customerId.trim());
  url.searchParams.set('limit', String(Math.max(1, Math.min(limit, 50))));

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 2500);

  try {
    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${secretKey}`
      },
      signal: controller.signal
    });

    if (!response.ok) {
      return [];
    }

    const payload = (await response.json()) as {
      data?: Array<{
        id?: string;
        created?: number;
        amount_paid?: number | string;
        status?: string;
        collection_method?: string;
        hosted_invoice_url?: string | null;
        invoice_pdf?: string | null;
      }>;
    };

    return (payload.data ?? [])
      .filter((invoice) => Boolean(invoice?.id))
      .map((invoice) => ({
        id: invoice.id!,
        date: invoice.created ? new Date(invoice.created * 1000).toISOString() : new Date().toISOString(),
        amount: asIntegerCents(invoice.amount_paid ?? 0) / 100,
        status: invoice.status ?? 'unknown',
        method: invoice.collection_method ?? 'unknown',
        hostedInvoiceUrl: invoice.hosted_invoice_url ?? null,
        invoicePdfUrl: invoice.invoice_pdf ?? null
      }));
  } catch {
    return [];
  } finally {
    clearTimeout(timeout);
  }
}
