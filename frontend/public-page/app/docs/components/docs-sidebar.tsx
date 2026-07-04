'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import { DOCS_NAV } from '../nav';

/** Left-hand docs navigation. Highlights the active page. */
export function DocsSidebar({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  return (
    // Compact enough that the full tree fits a typical viewport without
    // scrolling its column.
    <nav className="flex flex-col gap-3">
      {DOCS_NAV.map((section) => (
        <div key={section.title}>
          <p className="mb-0.5 font-mono text-[10px] font-semibold uppercase tracking-[0.14em] text-ink-faint">
            {section.title}
          </p>
          <ul className="flex flex-col">
            {section.links.map((link) => {
              const active = pathname === link.href;
              return (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    onClick={onNavigate}
                    className={cn(
                      'block rounded-md px-2.5 py-[3px] text-[12.5px] leading-snug transition-colors',
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
