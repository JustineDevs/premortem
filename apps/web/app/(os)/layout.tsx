import type { Metadata } from 'next';
import type { CSSProperties } from 'react';

import { OsProviders } from '@/providers/os-providers';
import { premortemBrand } from '@/lib/premortem-os/branding';
import { requireUserSession } from '@/lib/server/require-user-session';
import '@/components/premortem-os/premortem-os.css';

const fontVariables = {
  '--font-inter': '"Inter"',
  '--font-space-grotesk': '"Space Grotesk"',
  '--font-jetbrains-mono': '"JetBrains Mono"'
} as CSSProperties;

export const metadata: Metadata = {
  title: `${premortemBrand.consoleTitle} | ${premortemBrand.productName}`,
  description: `Run on your repo before it breaks production. ${premortemBrand.productName} reviewer console at ${premortemBrand.domain}.`,
  robots: {
    index: false,
    follow: false
  }
};

export default async function PremortemOsLayout({ children }: { children: React.ReactNode }) {
  await requireUserSession('/app');

  return (
    <OsProviders>
      <div className="premortem-os-root h-screen w-screen overflow-hidden" style={fontVariables}>
        {children}
      </div>
    </OsProviders>
  );
}
