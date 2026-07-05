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
  images: {
    unoptimized: true,
  },
  output: 'standalone',
  async headers() {
    // Baseline security headers. The CSP is deliberately pragmatic rather
    // than nonce-strict: Next.js inline runtime scripts need 'unsafe-inline',
    // Google Sign-In loads from accounts.google.com, and the API lives on
    // another origin (https in docker/prod, http://localhost in bare dev).
    // Tighten connect-src to your API hosts when you fork this template.
    // 'unsafe-eval' is only needed by `next dev` (HMR/eval sourcemaps);
    // production Next runs fine without it, so don't ship it there.
    const isDev = process.env.NODE_ENV !== 'production';

    // Build connect-src from the configured API origins. In dev we also allow a
    // blanket https: plus localhost so a bare-metal dev setup works; in
    // production we restrict to 'self' and the explicit API hosts so an XSS
    // payload cannot exfiltrate to any HTTPS host.
    const apiOrigin = (url) => {
      try {
        return new URL(url).origin;
      } catch {
        return null;
      }
    };
    const apiOrigins = [
      process.env.NEXT_PUBLIC_API_URL,
      process.env.NEXT_PUBLIC_SERVICE2_API_URL,
    ]
      .map((u) => (u ? apiOrigin(u) : null))
      .filter(Boolean);
    const connectSrc = isDev
      ? "connect-src 'self' https: http://localhost:* http://127.0.0.1:*"
      : ['connect-src', "'self'", ...new Set(apiOrigins)].join(' ');

    const csp = [
      "default-src 'self'",
      `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ''} https://accounts.google.com`,
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: blob:",
      "font-src 'self' data:",
      connectSrc,
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
          // One year, matching helmet's value on the API hosts. The app owns
          // this header: Caddy no longer sets a conflicting copy.
          { key: 'Strict-Transport-Security', value: 'max-age=31536000; includeSubDomains' },
        ],
      },
    ];
  },
};

export default withNextIntl(withMDX(nextConfig));
