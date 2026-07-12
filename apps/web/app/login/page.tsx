import { Suspense } from 'react';

import { AuthProviderForm } from '@/components/auth/auth-provider-form';
import { MarketingPageLayout } from '@/components/landing/marketing-page-layout';
import { getAuthProviderBootstrap } from '@/lib/auth/auth-provider-bootstrap';
import { buildSeoMetadata, canonicalSupportKeywords } from '@/lib/seo-metadata';

export const metadata = buildSeoMetadata({
  title: 'Log in | Premortem',
  description: 'Log in to Premortem.',
  canonical: '/login',
  keywords: canonicalSupportKeywords,
  noIndex: true,
  includeCanonicalSiteKeywords: false
});
export const dynamic = 'force-dynamic';

export default async function LoginPage() {
  const bootstrap = await getAuthProviderBootstrap();

  return (
    <MarketingPageLayout variant="auth">
      <Suspense fallback={null}>
        <AuthProviderForm
          mode="login"
          initialBootstrap={bootstrap}
          title="Log in"
          description="Sign in to Premortem."
          alternateHref="/signup"
          alternateLabel="Need an account? Sign up"
        />
      </Suspense>
    </MarketingPageLayout>
  );
}
