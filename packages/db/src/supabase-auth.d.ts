export interface VerifiedSupabaseUser {
    id: string;
    email?: string | null;
}
export declare function extractBearerToken(request: Request): string | null;
export declare function extractApiKeyToken(request: Request): string | null;
export declare function verifySupabaseAccessToken(accessToken: string): Promise<VerifiedSupabaseUser | null>;
//# sourceMappingURL=supabase-auth.d.ts.map