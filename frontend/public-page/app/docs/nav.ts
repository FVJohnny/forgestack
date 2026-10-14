/**
 * Docs navigation tree. Single source of truth for the sidebar and for
 * prev/next links. Order here is the order shown in the sidebar.
 */
export type DocLink = { title: string; href: string };
export type DocSection = { title: string; links: DocLink[] };

export const DOCS_NAV: DocSection[] = [
  {
    title: 'Overview',
    links: [
      { title: 'Introduction', href: '/docs' },
      { title: 'Architecture', href: '/docs/architecture' },
      { title: 'Project Structure', href: '/docs/project-structure' },
    ],
  },
  {
    title: 'Backend',
    links: [
      { title: 'Overview', href: '/docs/backend' },
      { title: 'Hexagonal Architecture', href: '/docs/backend/hexagonal' },
      { title: 'Domain-Driven Design', href: '/docs/backend/ddd' },
      { title: 'CQRS', href: '/docs/backend/cqrs' },
      { title: 'Repositories', href: '/docs/backend/repositories' },
      { title: 'Event-Driven Architecture', href: '/docs/backend/events' },
      { title: 'Testing', href: '/docs/backend/testing' },
      { title: 'Enforced Boundaries', href: '/docs/backend/eslint-rules' },
    ],
  },
  {
    title: 'Frontend',
    links: [
      { title: 'Overview', href: '/docs/frontend' },
      { title: 'Design System', href: '/docs/frontend/design-system' },
      { title: 'Internationalisation', href: '/docs/frontend/i18n' },
      { title: 'The App', href: '/docs/frontend/console' },
      { title: 'Calling Backend Services', href: '/docs/frontend/backend-services' },
      { title: 'Writing Docs', href: '/docs/frontend/writing-docs' },
    ],
  },
  {
    title: 'Platform',
    links: [
      { title: 'Databases', href: '/docs/databases' },
      { title: 'Monitoring', href: '/docs/monitoring' },
      { title: 'Deployment', href: '/docs/deployment' },
    ],
  },
  {
    title: 'Guides',
    links: [
      { title: 'Make It Yours', href: '/docs/guides/make-it-yours' },
      { title: 'Adding a Service', href: '/docs/guides/adding-a-service' },
      { title: 'Login with Google', href: '/docs/guides/login-with-google' },
    ],
  },
];

/** Flattened, ordered list of every doc link, used for prev/next. */
export const DOCS_FLAT: DocLink[] = DOCS_NAV.flatMap((s) => s.links);

export function getAdjacentDocs(pathname: string): { prev?: DocLink; next?: DocLink } {
  const i = DOCS_FLAT.findIndex((l) => l.href === pathname);
  if (i === -1) return {};
  return {
    prev: i > 0 ? DOCS_FLAT[i - 1] : undefined,
    next: i < DOCS_FLAT.length - 1 ? DOCS_FLAT[i + 1] : undefined,
  };
}
