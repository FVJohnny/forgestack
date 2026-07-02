# Contributing to ForgeStack

Thanks for your interest in contributing! This guide covers the basics for
getting set up and submitting changes.

## Getting started

```bash
npm run dev:start
```

This provisions prerequisites (Node, Docker), installs git hooks, creates
`.env` files from the examples, and brings up the full stack via Docker
Compose. See the [README](README.md) and [`docs/`](docs/) for details.

## Development workflow

- **Branch** off `main` for your change.
- Make focused commits — see commit conventions below.
- Before opening a PR, make sure the checks pass:

  ```bash
  npm run typecheck
  npm run lint
  npm run test
  ```

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
- Has `typecheck`, `lint` and `test` all green.

## Architecture & style

ForgeStack follows DDD + CQRS with a hexagonal layout, and several custom
ESLint rules enforce its boundaries. Before adding code, skim
[`docs/architecture.md`](docs/architecture.md) and
[`docs/code-style.md`](docs/code-style.md) so your change fits the existing
patterns.

## Reporting security issues

Please do **not** open public issues for security vulnerabilities — see
[SECURITY.md](SECURITY.md).
