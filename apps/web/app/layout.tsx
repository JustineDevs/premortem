import type { Metadata } from 'next';
import { GeistSans } from 'geist/font/sans';
import { Inter } from 'next/font/google';
import './globals.css';

const inter = Inter({
  subsets: ['latin'],
  weight: ['400', '500', '700'],
  variable: '--font-inter'
});

export const metadata: Metadata = {
  title: 'Premortem',
  description: 'Run on your repo before it breaks production.',
  icons: {
    icon: '/logo/png/Premortem_abstract.png',
    apple: '/logo/png/Premortem_abstract.png'
  }
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${GeistSans.variable} ${inter.variable}`}>
      <body className={GeistSans.className}>{children}</body>
    </html>
  );
}
