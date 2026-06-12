import { Suspense } from 'react';

import { AuthProviderForm } from '@/components/auth/auth-provider-form';
import { MarketingPageLayout } from '@/components/landing/marketing-page-layout';
import { authLinks } from '@/lib/auth-links';
import { buildSeoMetadata, canonicalSupportKeywords } from '@/lib/seo-metadata';

export const metadata = buildSeoMetadata({
  title: 'Sign up | Premortem',
  description: 'Create a Premortem account with GitLab.',
  canonical: '/signup',
  keywords: canonicalSupportKeywords,
  noIndex: true,
  includeCanonicalSiteKeywords: false
});

export default function SignUpPage() {
  return (
    <MarketingPageLayout variant="auth">
      <Suspense fallback={null}>
        <AuthProviderForm
          mode="signup"
          title="Sign up"
          description="Connect GitLab to create your Premortem workspace and start predictive audits."
          alternateHref={authLinks.login}
          alternateLabel="Already have an account? Log in"
        />
      </Suspense>
    </MarketingPageLayout>
  );
}
