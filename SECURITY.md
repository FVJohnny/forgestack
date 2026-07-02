# Security Policy

## Reporting a vulnerability

If you discover a security vulnerability in ForgeStack, please report it
privately rather than opening a public issue.

Use GitHub's [private vulnerability reporting](https://docs.github.com/en/code-security/security-advisories/guidance-on-reporting-and-writing-information-about-vulnerabilities/privately-reporting-a-security-vulnerability)
("Report a vulnerability" under the repository's **Security** tab), or contact
the maintainer directly through their GitHub profile.

Please include:

- A description of the issue and its potential impact.
- Steps to reproduce, or a proof of concept.
- Any suggested remediation, if you have one.

We will acknowledge your report as soon as possible and keep you informed of
the fix.

## Scope

ForgeStack is a starter template. The example credentials, secrets and
configuration shipped in this repository (`.env.example`, `*.example` files,
default dev passwords) are intentional placeholders for local development —
they are **not** secrets. Anyone deploying ForgeStack is responsible for
replacing every placeholder with their own strong, secret values before going
to production. See [`docs/deployment.md`](docs/deployment.md).
