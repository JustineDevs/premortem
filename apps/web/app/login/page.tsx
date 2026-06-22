import { Suspense } from 'react';

import { AuthProviderForm } from '@/components/auth/auth-provider-form';
import { MarketingPageLayout } from '@/components/landing/marketing-page-layout';
import { buildSeoMetadata, canonicalSupportKeywords } from '@/lib/seo-metadata';

export const metadata = buildSeoMetadata({
  title: 'Log in | Premortem',
  description: 'Log in to Premortem with GitLab. When enabled, Cloudflare Turnstile runs before sign-in continues.',
  canonical: '/login',
  keywords: canonicalSupportKeywords,
  noIndex: true,
  includeCanonicalSiteKeywords: false
});

export default function LoginPage() {
  return (
    <MarketingPageLayout variant="auth">
      <Suspense fallback={null}>
        <AuthProviderForm
          mode="login"
          title="Log in"
          description="Use GitLab to access your Premortem workspace, audits, and reviewer console. When enabled, Cloudflare Turnstile runs before sign-in continues."
          alternateHref="/signup"
          alternateLabel="Need an account? Sign up"
        />
      </Suspense>
    </MarketingPageLayout>
  );
}
