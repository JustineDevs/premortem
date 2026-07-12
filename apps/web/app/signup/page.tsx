import { Suspense } from 'react';

import { AuthProviderForm } from '@/components/auth/auth-provider-form';
import { MarketingPageLayout } from '@/components/landing/marketing-page-layout';
import { getAuthProviderBootstrap } from '@/lib/auth/auth-provider-bootstrap';
import { authLinks } from '@/lib/auth-links';
import { buildSeoMetadata, canonicalSupportKeywords } from '@/lib/seo-metadata';

export const metadata = buildSeoMetadata({
  title: 'Sign up | Premortem',
  description: 'Create a Premortem account.',
  canonical: '/signup',
  keywords: canonicalSupportKeywords,
  noIndex: true,
  includeCanonicalSiteKeywords: false
});
export const dynamic = 'force-dynamic';

export default async function SignUpPage() {
  const bootstrap = await getAuthProviderBootstrap();

  return (
    <MarketingPageLayout variant="auth">
      <Suspense fallback={null}>
        <AuthProviderForm
          mode="signup"
          initialBootstrap={bootstrap}
          title="Sign up"
          description="Create your account."
          alternateHref={authLinks.login}
          alternateLabel="Already have an account? Log in"
        />
      </Suspense>
    </MarketingPageLayout>
  );
}
