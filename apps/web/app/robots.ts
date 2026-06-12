import type { MetadataRoute } from 'next';

const siteUrl = new URL(process.env.NEXT_PUBLIC_APP_URL ?? 'https://premortem.jstn.site');

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: ['/api/', '/app/', '/auth/', '/forgot-password', '/reset-password']
      }
    ],
    sitemap: new URL('/sitemap.xml', siteUrl).toString()
  };
}
