import type { Metadata } from 'next';

import { PasswordResetForm } from '@/components/auth/password-reset-form';
import { MarketingPageLayout } from '@/components/landing/marketing-page-layout';
import { authLinks } from '@/lib/auth-links';

export const metadata: Metadata = {
  title: 'Reset password | Premortem',
  description: 'Request a password reset link for your Premortem account.',
  robots: {
    index: false,
    follow: false
  }
};

export default function ForgotPasswordPage() {
  return (
    <MarketingPageLayout variant="auth">
      <PasswordResetForm
        mode="request"
        title="Reset your password"
        description="We will email a link that lets you choose a new password for your Premortem account."
        alternateHref={authLinks.login}
        alternateLabel="Back to log in"
      />
    </MarketingPageLayout>
  );
}
