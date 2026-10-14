# Security Policy

## Supported versions

ForgeStack is a starter template, so there are no maintained release branches.
Security fixes target the latest `main` branch only. If you use ForgeStack,
track `main` for security updates.

## Reporting a vulnerability

If you discover a security vulnerability in ForgeStack, please report it
privately. Do **not** open a public issue, discussion or pull request for
security reports.

**[Report a vulnerability](https://github.com/FVJohnny/forgestack/security/advisories/new)**
through GitHub's private vulnerability reporting (the **Security** tab of the
repository → **Report a vulnerability**). See GitHub's
[private vulnerability reporting docs](https://docs.github.com/en/code-security/security-advisories/guidance-on-reporting-and-writing-information-about-vulnerabilities/privately-reporting-a-security-vulnerability)
for the steps.

Please include:

- A description of the issue and its potential impact.
- Steps to reproduce, or a proof of concept.
- The affected files, services or configuration.
- Any suggested remediation, if you have one.

We will acknowledge your report as soon as possible and keep you informed of
the fix.

## Scope

ForgeStack is a starter template. The example credentials, secrets and
configuration shipped in this repository (`.env.example`, `*.example` files,
default dev passwords such as the seeded dev admin) are intentional
placeholders for local development. They are **not** secrets. Anyone
deploying ForgeStack is responsible for replacing every placeholder with their
own strong, secret values before going to production; the services refuse to
boot in production with the example JWT secrets, and the deploy script refuses
the example internal API key. See [`docs/deployment.md`](docs/deployment.md).
