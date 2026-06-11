import type { Metadata } from 'next';
import { Inter, JetBrains_Mono, Space_Grotesk } from 'next/font/google';

import { OsProviders } from '@/providers/os-providers';
import { premortemBrand } from '@/lib/premortem-os/branding';
import '@/components/premortem-os/premortem-os.css';

const inter = Inter({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-inter'
});

const spaceGrotesk = Space_Grotesk({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-space-grotesk'
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  weight: ['400', '500', '600'],
  variable: '--font-jetbrains-mono'
});

export const metadata: Metadata = {
  title: `${premortemBrand.consoleTitle} | ${premortemBrand.productName}`,
  description: `Run on your repo before it breaks production. ${premortemBrand.productName} reviewer console at ${premortemBrand.domain}.`
};

export default function PremortemOsLayout({ children }: { children: React.ReactNode }) {
  return (
    <OsProviders>
      <div
        className={`premortem-os-root ${inter.variable} ${spaceGrotesk.variable} ${jetbrainsMono.variable} h-screen w-screen overflow-hidden`}
      >
        {children}
      </div>
    </OsProviders>
  );
}
