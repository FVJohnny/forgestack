# Frontend Architecture (`frontend/public-page/`)

Next.js 16 App Router with React 19, standalone output mode. The shipped app is an auth-only shell you can build on.

## Routing

- `/` (landing / entry page)
- `/login`, `/register`, `/verify-email`, `/forgot-password`, `/reset-password` (auth flows)

## State management

React Context API — providers live in `lib/contexts/` (e.g. `auth-context`, `user-context`, `google-oauth-provider`).

## API layer

Generic `APIClient` class in `lib/api/` with error handling and toast notifications.

## i18n

`next-intl` with 8 locales (`en`, `es`, `pt`, `de`, `fr`, `nl`, `pl`, `th`). Canonical list lives in `frontend/public-page/i18n/config.ts`. Locale detection from `NEXT_LOCALE` cookie or `Accept-Language` header.

- Translation files live in `frontend/public-page/messages/{locale}.json` (e.g., `en.json`, `es.json`)
- Keys are nested by section (e.g., `auth.login.title`)
- When adding or modifying translations, **always update all 8 locale files** — `en.json` is the source of truth, translate values appropriately for each locale
- Use `useTranslations('namespace')` hook from `next-intl` to access translations in components
- Translation keys for domain type values (statuses, enums) must match the value exactly (e.g., `EMAIL_VERIFIED` not `emailVerified`) per the i18n key naming rule

## UI

- Radix UI primitives with shadcn/ui components in `app/shared/`
- Tailwind CSS v4

## Forms

react-hook-form + Zod validation
</content>
