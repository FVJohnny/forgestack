import type { MetadataRoute } from 'next';

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://localhost';

// Public, indexable routes. The auth flows and dashboard are intentionally
// excluded (they are gated / not useful in search results).
const routes = ['', '/login', '/register', '/docs'];

export default function sitemap(): MetadataRoute.Sitemap {
  return routes.map((path) => ({
    url: `${SITE_URL}${path}`,
    lastModified: new Date(),
    changeFrequency: 'weekly',
    priority: path === '' ? 1 : 0.7,
  }));
}
