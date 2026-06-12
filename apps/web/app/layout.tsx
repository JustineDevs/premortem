import type { Metadata } from 'next';
import { GeistSans } from 'geist/font/sans';
import { Inter } from 'next/font/google';
import './globals.css';

const inter = Inter({
  subsets: ['latin'],
  weight: ['400', '500', '700'],
  variable: '--font-inter'
});

const siteUrl = new URL(process.env.NEXT_PUBLIC_APP_URL ?? 'https://premortem.jstn.site');

export const metadata: Metadata = {
  metadataBase: siteUrl,
  title: 'Premortem',
  description: 'Run on your repo before it breaks production.',
  icons: {
    icon: '/logo/png/Premortem_abstract.png',
    apple: '/logo/png/Premortem_abstract.png'
  },
  openGraph: {
    title: 'Premortem',
    description: 'Run on your repo before it breaks production.',
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
    description: 'Run on your repo before it breaks production.',
    images: ['/opengraph-image']
  }
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${GeistSans.variable} ${inter.variable}`}>
      <body className={GeistSans.className}>{children}</body>
    </html>
  );
}
