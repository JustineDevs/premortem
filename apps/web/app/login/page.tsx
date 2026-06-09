import { Suspense } from 'react';

import { AuthProviderForm } from '@/components/auth/auth-provider-form';
import { MarketingPageLayout } from '@/components/landing/marketing-page-layout';
import { authLinks } from '@/lib/auth-links';

export const metadata = {
  title: 'Log in | Premortem',
  description: 'Log in to Premortem with GitLab.'
};

export default function LoginPage() {
  return (
    <MarketingPageLayout variant="auth">
      <Suspense fallback={null}>
        <AuthProviderForm
          mode="login"
          title="Log in"
          description="Use GitLab to access your Premortem workspace, audits, and reviewer console."
          alternateHref={authLinks.signup}
          alternateLabel="Need an account? Sign up"
        />
      </Suspense>
    </MarketingPageLayout>
  );
}
