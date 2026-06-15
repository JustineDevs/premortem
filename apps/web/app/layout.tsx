import type { Metadata } from 'next';
import type { CSSProperties } from 'react';

import './globals.css';

const fontVariables = {
  '--font-inter': '"Inter"',
  '--font-geist-sans': '"Geist"'
} as CSSProperties;

const siteUrl = new URL(process.env.NEXT_PUBLIC_APP_URL ?? 'https://premortem.jstn.site');

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
        url: '/opengraph-image',
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
    images: ['/opengraph-image']
  }
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" style={fontVariables}>
      <body>{children}</body>
    </html>
  );
}
