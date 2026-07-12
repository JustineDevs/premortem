import type { Metadata } from 'next';

import { assertCoreObservabilityConfigured } from '@premortem/observability/boot';
import { OsProviders } from '@/providers/os-providers';
import { premortemBrand } from '@/lib/premortem-os/branding';
import { requireUserSession } from '@/lib/server/require-user-session';
import '@/components/premortem-os/premortem-os.css';

export const metadata: Metadata = {
  title: `${premortemBrand.consoleTitle} | ${premortemBrand.productName}`,
  description: `Run on your repo before it breaks production. ${premortemBrand.productName} reviewer console at ${premortemBrand.domain}.`,
  robots: {
    index: false,
    follow: false
  }
};

export default async function PremortemOsLayout({ children }: { children: React.ReactNode }) {
  assertCoreObservabilityConfigured();
  await requireUserSession('/app');

  return (
    <OsProviders>
      <div className="premortem-os-root min-h-dvh w-full overflow-x-hidden">
        {children}
      </div>
    </OsProviders>
  );
}
