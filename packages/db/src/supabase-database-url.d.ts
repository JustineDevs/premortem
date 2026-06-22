/**
 * Supabase free-tier Postgres: runtime uses transaction pooler (:6543),
 * migrations use session pooler (:5432) on the same pooler host — not db.*.supabase.co direct.
 */
export declare function shouldNormalizeSupabaseDatabaseUrl(raw: string): boolean;
/** Transaction mode for Prisma runtime queries (port 6543 + pgbouncer=true). */
export declare function normalizeTransactionPoolerUrl(raw: string, env?: NodeJS.ProcessEnv): string;
/** Session mode for Prisma migrations (port 5432 on pooler host, no pgbouncer flag). */
export declare function normalizeSessionPoolerUrl(raw: string, transactionUrl?: string): string;
export declare function deriveSessionPoolerFromTransaction(transactionUrl: string): string;
export declare function applySupabaseDatabaseEnv(env?: NodeJS.ProcessEnv): NodeJS.ProcessEnv;
//# sourceMappingURL=supabase-database-url.d.ts.map