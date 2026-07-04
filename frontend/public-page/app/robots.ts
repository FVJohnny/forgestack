import type { MetadataRoute } from 'next';

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://localhost';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      // Keep the authenticated console out of search indexes.
      disallow: ['/dashboard'],
    },
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
