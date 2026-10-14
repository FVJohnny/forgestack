# Frontend Architecture (`frontend/public-page/`)

> Quick in-repo reference. The canonical page is **[Frontend](https://forgestack.fvjohnny.com/docs/frontend)** on the docs site; when the two disagree, the docs site wins.

Next.js 16 App Router with React 19, standalone output mode. The shipped app has a landing page, full auth flows, a simple signed-in app to build on, and an MDX documentation site. Operational stats live in Grafana, not in the app.

The frontend is a standalone **pnpm** project (outside the root npm workspaces). In dev it runs in its own container behind Caddy at `https://localhost`.

## Routing

- `/` (landing / entry page)
- `/login`, `/register`, `/verify-email`, `/forgot-password`, `/reset-password` (auth flows)
- `/dashboard` (the signed-in app: home with sign-in activity, tasks backed by service-2, account, and admin)
- `/docs` (MDX documentation site)

## State management

React Context API. Providers live in `lib/contexts/` (e.g. `auth-context`, `user-context`, `google-oauth-provider`).

## API layer

`lib/api/client.ts` defines a generic `APIClient` with one instance per backend service (`apiClient` for service-1, `service2ApiClient` for service-2). Base URLs come from `lib/api/config.ts` (`NEXT_PUBLIC_API_URL`, `NEXT_PUBLIC_SERVICE2_API_URL`): each service sits under a path prefix on the frontend's own origin (`/svc1`, `/svc2`), so the httpOnly auth cookies are first-party and sent automatically. On a 401 the client refreshes the session once through service-1 and retries; failures surface as a typed `APIError`. Endpoint wrappers live in `lib/api/services/*.service.ts`. See [Calling Backend Services](https://forgestack.fvjohnny.com/docs/frontend/backend-services) to wire a new service in.

## i18n

`next-intl` with 8 locales (`en`, `es`, `pt`, `de`, `fr`, `nl`, `pl`, `th`). Canonical list lives in `frontend/public-page/i18n/config.ts`. Locale detection from `NEXT_LOCALE` cookie or `Accept-Language` header.

- Translation files live in `frontend/public-page/messages/{locale}.json` (e.g., `en.json`, `es.json`)
- Keys are nested by section (e.g., `auth.login.title`)
- When adding or modifying translations, **always update all 8 locale files**: `en.json` is the source of truth, translate values appropriately for each locale. `npm --prefix frontend/public-page run check:locales` (also run in CI) fails when the files' keys differ
- Use `useTranslations('namespace')` hook from `next-intl` to access translations in components
- Translation keys for domain type values (statuses, enums) must match the value exactly (e.g., `EMAIL_VERIFIED` not `emailVerified`) per the i18n key naming rule

## UI

- Radix UI primitives with shadcn/ui-style components in `app/shared/ui/`
- Tailwind CSS v4, driven by design tokens in `app/globals.css`
- Toast notifications with `sonner`

## Forms

Forms use no form library. Each one is a small client component with controlled inputs (`useState`), native HTML validation (`required`, `type="email"`, `minLength`) and a few explicit checks before submit (e.g. `lib/utils/password.ts` mirrors the backend password policy). The backend stays the source of truth for validation: server errors are turned into a message with `formErrorMessage()` from `lib/api/error-handler.ts` and shown with the `FormAlert` component. See `app/login/components/login-form.tsx` and `app/register/components/` for the pattern.
