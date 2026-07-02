'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import { DOCS_NAV } from '../nav';

/** Left-hand docs navigation. Highlights the active page. */
export function DocsSidebar({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  return (
    <nav className="flex flex-col gap-4">
      {DOCS_NAV.map((section) => (
        <div key={section.title}>
          <p className="mb-1 font-mono text-[11px] font-semibold uppercase tracking-[0.14em] text-ink-faint">
            {section.title}
          </p>
          <ul className="flex flex-col gap-0.5">
            {section.links.map((link) => {
              const active = pathname === link.href;
              return (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    onClick={onNavigate}
                    className={cn(
                      'block rounded-md px-3 py-1 text-[13px] transition-colors',
                      active
                        ? 'bg-primary/10 font-medium text-primary'
                        : 'text-ink-dim hover:bg-elevated hover:text-ink',
                    )}
                  >
                    {link.title}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </nav>
  );
}
