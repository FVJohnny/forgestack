# ForgeStack — Public Page

The Next.js frontend for ForgeStack: the public landing page, documentation
section, authentication flows (login, register, password reset, email
verification) and the authenticated dashboard.

## Stack

- [Next.js](https://nextjs.org/) (App Router) + React
- [next-intl](https://next-intl.dev/) for internationalization
- Tailwind CSS with a small set of [Radix UI](https://www.radix-ui.com/) primitives
- MDX-powered docs

## Package manager

This app uses **pnpm** and is intentionally standalone — it is *not* part of the
repo-root npm workspaces (which cover the backend only). Run commands from this
directory.

```bash
pnpm install
pnpm dev      # start the dev server
pnpm build    # production build
pnpm lint
```

Configuration lives in `.env.local` — copy `.env.local.example` to get started.
The most important variable is `NEXT_PUBLIC_API_URL`, pointing at the backend API.

> When running the full stack via `npm run dev:start` from the repo root, the
> frontend is started and proxied through Caddy automatically.
