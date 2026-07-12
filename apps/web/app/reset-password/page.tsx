import type { Metadata } from 'next';

import { PasswordResetForm } from '@/components/auth/password-reset-form';
import { MarketingPageLayout } from '@/components/landing/marketing-page-layout';
import { authLinks } from '@/lib/auth-links';
import { getAuthProviderBootstrap } from '@/lib/auth/auth-provider-bootstrap';
import { buildSeoMetadata, canonicalSupportKeywords } from '@/lib/seo-metadata';

export const metadata: Metadata = buildSeoMetadata({
  title: 'Create a new password | Premortem',
  description: 'Create a new password for your Premortem account.',
  canonical: '/reset-password',
  keywords: canonicalSupportKeywords,
  noIndex: true,
  includeCanonicalSiteKeywords: false
});
export const dynamic = 'force-dynamic';

export default async function ResetPasswordPage() {
  const bootstrap = await getAuthProviderBootstrap();
  return (
    <MarketingPageLayout variant="auth">
      <PasswordResetForm
        mode="reset"
        title="Create a new password"
        description="Pick a new password for your Premortem account after opening the recovery link."
        alternateHref={authLinks.login}
        alternateLabel="Back to log in"
        initialBootstrap={bootstrap}
      />
    </MarketingPageLayout>
  );
}
