# Contributing to ForgeStack

Thanks for your interest in contributing! This guide covers the basics for
getting set up and submitting changes. Questions are welcome in
[GitHub Discussions](https://github.com/FVJohnny/forgestack/discussions).

## Getting started

```bash
npm run dev:start
```

This checks prerequisites (it verifies Node matches `.nvmrc` and can install
Docker if it is missing, but never auto-installs Node), installs git hooks,
creates `.env` files from the examples, and brings up the full stack via
Docker Compose. See the [README](README.md#getting-started) for the
prerequisites, local URLs and logins, and [`docs/`](docs/) for details.

The checks below run Nx targets for every project, including the frontend,
which installs with pnpm. Install its dependencies once:

```bash
corepack enable
pnpm -C frontend/public-page install
```

## Development workflow

- **Branch** off `main` for your change.
- Make focused commits (see commit conventions below).
- Before opening a PR, make sure the same checks CI runs pass:

  ```bash
  npm run typecheck
  npm run lint
  npm run test
  npm run test:eslint-rules                             # tests for the custom ESLint rules
  npm --prefix frontend/public-page run check:locales   # every locale file has the same keys
  npm run build
  ```

  `npm run test` needs MongoDB and Redis on localhost: the mongodb and redis
  repository contract tests hit real datastores and fail with connection
  errors without them. Keep the dev stack running (`npm run dev:start`), or
  start just those two:

  ```bash
  docker compose -f infra/compose/docker-compose.dev.yml up -d mongodb redis
  ```

- The pre-commit hook runs lint-staged on the staged files, then typecheck and
  tests for the affected projects, so MongoDB and Redis should be up when you
  commit too.

## Commit conventions

Commits follow the [Conventional Commits](https://www.conventionalcommits.org/)
format, enforced by commitlint via a git hook:

```
feat(auth): add refresh token rotation
fix(kafka): handle reconnect on broker restart
docs: clarify deployment steps
```

Include a scope when it helps (`feat(auth): …`, `fix(infra): …`).

## Pull requests

A good PR:

- Summarizes the behavioural change and notes impacted services/libs.
- Links any related issue.
- Calls out new env vars, migrations, or breaking changes.
- Includes screenshots for UI changes.
- Has all of the checks above green.

## Architecture & style

ForgeStack follows DDD + CQRS with a hexagonal layout, and several custom
ESLint rules enforce its boundaries. Before adding code, skim
[`docs/architecture.md`](docs/architecture.md) and
[`docs/code-style.md`](docs/code-style.md) (file and class naming is
load-bearing) so your change fits the existing patterns. The
[docs site](https://forgestack.fvjohnny.com/docs) covers each pattern in depth.

## Reporting security issues

Please do **not** open public issues for security vulnerabilities. See
[SECURITY.md](SECURITY.md).

## Code of Conduct

This project follows a [Code of Conduct](CODE_OF_CONDUCT.md). By participating,
you are expected to uphold it.
