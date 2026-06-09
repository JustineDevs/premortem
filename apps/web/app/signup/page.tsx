import { Suspense } from 'react';

import { AuthProviderForm } from '@/components/auth/auth-provider-form';
import { MarketingPageLayout } from '@/components/landing/marketing-page-layout';
import { authLinks } from '@/lib/auth-links';

export const metadata = {
  title: 'Sign up | Premortem',
  description: 'Create a Premortem account with GitLab.'
};

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
