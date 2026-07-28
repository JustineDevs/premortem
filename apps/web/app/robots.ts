import type { MetadataRoute } from 'next';

import { getCanonicalSiteOrigin } from '@/lib/runtime-config';

const siteUrl = new URL(getCanonicalSiteOrigin());

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
