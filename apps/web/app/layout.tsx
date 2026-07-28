import type { Metadata } from 'next';
import { Analytics } from '@vercel/analytics/next';
import { BotIdClient } from 'botid/client';
import { Suspense } from 'react';

import { SiteAnalytics } from '@/providers/site-analytics';
import { botIdProtectRoutes } from '@/lib/botid-protect';
import { getCanonicalSiteOrigin } from '@/lib/runtime-config';
import { isBotIdEnabled } from '@/lib/server/botid';
import './globals.css';

const siteUrl = new URL(getCanonicalSiteOrigin());

export const metadata: Metadata = {
  metadataBase: siteUrl,
  title: 'Premortem',
  description: 'Predictive repository audits, swarm analysis, and GitLab issue synthesis for software delivery risk.',
  icons: {
    icon: '/logo/svg/premortem-mark.svg',
    apple: '/logo/svg/premortem-mark.svg'
  },
  openGraph: {
    title: 'Premortem',
    description: 'Predictive repository audits, swarm analysis, and GitLab issue synthesis for software delivery risk.',
    url: siteUrl,
    siteName: 'Premortem',
    type: 'website',
    images: [
      {
        url: '/opengraph-image.svg',
        width: 1200,
        height: 630,
        alt: 'Premortem'
      }
    ]
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Premortem',
    description: 'Predictive repository audits, swarm analysis, and GitLab issue synthesis for software delivery risk.',
    images: ['/opengraph-image.svg']
  }
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        {isBotIdEnabled() ? <BotIdClient protect={botIdProtectRoutes} /> : null}
        <Suspense fallback={null}>
          <SiteAnalytics>{children}</SiteAnalytics>
        </Suspense>
        <Analytics />
      </body>
    </html>
  );
}
