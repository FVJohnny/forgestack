import createNextIntlPlugin from 'next-intl/plugin';
import createMDX from '@next/mdx';

const withNextIntl = createNextIntlPlugin('./i18n/request.ts');

// Plugins are referenced by package name (string form) rather than imported
// functions so the loader options stay serializable under Turbopack.
const withMDX = createMDX({
  options: {
    remarkPlugins: [['remark-gfm']],
    rehypePlugins: [
      ['rehype-slug'],
      // Shiki syntax highlighting. keepBackground: false so code blocks keep
      // the design system's card background; `vesper` is a near-black theme
      // with ember-orange accents that matches the site.
      ['rehype-pretty-code', { theme: 'vesper', keepBackground: false }],
    ],
  },
});

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Pin the workspace root to this app. Without it, Turbopack infers the
  // monorepo root (it finds the root package-lock.json) and the string-form
  // MDX plugins above fail to resolve from there in `next dev`.
  turbopack: {
    root: import.meta.dirname,
  },
  // Allow .mdx files to be treated as pages/components (docs live as MDX).
  pageExtensions: ['ts', 'tsx', 'js', 'jsx', 'md', 'mdx'],
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    unoptimized: true,
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'flagcdn.com',
      },
    ],
  },
  output: 'standalone',
  async headers() {
    // Baseline security headers. The CSP is deliberately pragmatic rather
    // than nonce-strict: Next.js inline runtime scripts need 'unsafe-inline',
    // Google Sign-In loads from accounts.google.com, language flags come from
    // flagcdn.com, and the API lives on another origin (https in docker/prod,
    // http://localhost in bare dev). Tighten connect-src to your API hosts
    // when you fork this template.
    const csp = [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://accounts.google.com",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: blob: https://flagcdn.com",
      "font-src 'self' data:",
      "connect-src 'self' https: http://localhost:* http://127.0.0.1:*",
      'frame-src https://accounts.google.com',
      "object-src 'none'",
      "base-uri 'self'",
      "form-action 'self'",
      "frame-ancestors 'none'",
    ].join('; ');

    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'Content-Security-Policy', value: csp },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
          { key: 'Strict-Transport-Security', value: 'max-age=15552000; includeSubDomains' },
        ],
      },
    ];
  },
};

export default withNextIntl(withMDX(nextConfig));
