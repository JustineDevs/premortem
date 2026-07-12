import type { Metadata } from 'next';

import { PasswordResetForm } from '@/components/auth/password-reset-form';
import { MarketingPageLayout } from '@/components/landing/marketing-page-layout';
import { authLinks } from '@/lib/auth-links';
import { getAuthProviderBootstrap } from '@/lib/auth/auth-provider-bootstrap';
import { buildSeoMetadata, canonicalSupportKeywords } from '@/lib/seo-metadata';

export const metadata: Metadata = buildSeoMetadata({
  title: 'Forgot your password | Premortem',
  description: 'Request a password reset link for your Premortem account.',
  canonical: '/forgot-password',
  keywords: canonicalSupportKeywords,
  noIndex: true,
  includeCanonicalSiteKeywords: false
});
export const dynamic = 'force-dynamic';

export default async function ForgotPasswordPage() {
  const bootstrap = await getAuthProviderBootstrap();
  return (
    <MarketingPageLayout variant="auth">
      <PasswordResetForm
        mode="request"
        title="Forgot your password"
        description="We will email a link that lets you choose a new password for your Premortem account."
        alternateHref={authLinks.login}
        alternateLabel="Back to log in"
        initialBootstrap={bootstrap}
      />
    </MarketingPageLayout>
  );
}
