import type { Metadata } from 'next';

import { PasswordResetForm } from '@/components/auth/password-reset-form';
import { MarketingPageLayout } from '@/components/landing/marketing-page-layout';
import { authLinks } from '@/lib/auth-links';
import { buildSeoMetadata, canonicalSupportKeywords } from '@/lib/seo-metadata';

export const metadata: Metadata = buildSeoMetadata({
  title: 'Set new password | Premortem',
  description: 'Create a new password for your Premortem account.',
  canonical: '/reset-password',
  keywords: canonicalSupportKeywords,
  noIndex: true,
  includeCanonicalSiteKeywords: false
});

export default function ResetPasswordPage() {
  return (
    <MarketingPageLayout variant="auth">
      <PasswordResetForm
        mode="reset"
        title="Create a new password"
        description="Pick a new password for your Premortem account after opening the recovery link."
        alternateHref={authLinks.login}
        alternateLabel="Back to log in"
      />
    </MarketingPageLayout>
  );
}
