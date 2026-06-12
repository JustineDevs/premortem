/**
 * Compatibility shim for the historical auth namespace.
 * Supabase and GitLab are wired. GitHub and Entra remain roadmap items.
 */
export const authService = {
  kind: 'compatibility-shim' as const,
  providers: ['supabase', 'gitlab'],
  comingSoonProviders: ['github', 'microsoft-entra-id']
};
