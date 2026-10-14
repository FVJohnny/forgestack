## What

<!-- What does this change do, and why? Link any related issue. -->

## How to test

<!-- Steps for a reviewer to verify the change. -->

## Checklist

- [ ] `npm run lint`, `npm run typecheck`, `npm run test` and `npm run build` pass locally
- [ ] `npm run test:eslint-rules` and `npm --prefix frontend/public-page run check:locales` pass (CI runs both)
- [ ] Architectural boundaries respected (the custom ESLint rules are green)
- [ ] Tests added or updated for the change
- [ ] New env vars, migrations or breaking changes are called out above
- [ ] Docs updated if behavior or configuration changed (README, `docs/`, or the docs site under `frontend/public-page/app/docs/`)
