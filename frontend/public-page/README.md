# ForgeStack — Public Page

The Next.js frontend for ForgeStack: the public landing page, documentation
section, authentication flows (login, register, password reset, email
verification) and the authenticated dashboard.

## Stack

- [Next.js](https://nextjs.org/) 16 (App Router) + React 19
- [next-intl](https://next-intl.dev/) for internationalization (8 locales)
- Tailwind CSS v4 with a small set of [Radix UI](https://www.radix-ui.com/) primitives
- MDX-powered docs (`app/docs/`), published at
  [forgestack.fvjohnny.com/docs](https://forgestack.fvjohnny.com/docs)

## Running it

Normally you don't run this app on its own: `npm run dev:start` from the repo
root starts it in a container (with hot reload) and serves it through Caddy at
`https://localhost`, on the same origin as the backend APIs (`/svc1`, `/svc2`).
The auth cookies rely on that same-origin setup.

## Package manager

This app uses **pnpm** and is intentionally standalone — it is _not_ part of the
repo-root npm workspaces (which cover the backend only). Install its
dependencies on your machine to run the repo-wide `npm run lint`, `typecheck`,
`test` and `build`, or to work on it directly. Run these from this directory:

```bash
corepack enable   # provides the pnpm version pinned in package.json
pnpm install
pnpm dev          # start the dev server outside Docker
pnpm build        # production build
pnpm lint
pnpm test
pnpm check:locales   # every locale file has the same keys (CI runs this)
```

Configuration lives in `.env.local` — `npm run dev:start` copies it from
`.env.local.example`. `NEXT_PUBLIC_API_URL` and `NEXT_PUBLIC_SERVICE2_API_URL`
point at the backend services. `NEXT_PUBLIC_*` values are inlined into the
client bundle, so restart the dev server (or rebuild) after changing them.

See the [Frontend docs](https://forgestack.fvjohnny.com/docs/frontend) for the
conventions (design system, i18n, calling backend services).
