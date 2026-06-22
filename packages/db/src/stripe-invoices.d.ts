export interface StripeInvoiceSummary {
    id: string;
    date: string;
    amount: number;
    status: string;
    method: string;
    hostedInvoiceUrl: string | null;
    invoicePdfUrl: string | null;
}
export declare function listStripeInvoicesForCustomer(customerId: string, limit?: number): Promise<StripeInvoiceSummary[]>;
//# sourceMappingURL=stripe-invoices.d.ts.map