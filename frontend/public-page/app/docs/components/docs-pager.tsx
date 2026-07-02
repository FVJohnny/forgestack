'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ArrowLeft, ArrowRight } from 'lucide-react';
import { getAdjacentDocs } from '../nav';

/** Prev/next navigation at the bottom of each doc page. */
export function DocsPager() {
  const pathname = usePathname();
  const { prev, next } = getAdjacentDocs(pathname);
  if (!prev && !next) return null;
  return (
    <div className="mt-14 grid grid-cols-2 gap-4 border-t border-line pt-8">
      {prev ? (
        <Link
          href={prev.href}
          className="group flex flex-col gap-1.5 rounded-xl border border-line-strong bg-card/70 p-5 transition-all duration-200 hover:-translate-y-0.5 hover:border-primary/60 hover:glow-soft"
        >
          <span className="flex items-center gap-1.5 font-mono text-[11px] uppercase tracking-[0.1em] text-ink-dim">
            <ArrowLeft className="size-3.5 transition-transform duration-200 group-hover:-translate-x-0.5" />
            Previous
          </span>
          <span className="text-[15px] font-semibold text-ink group-hover:text-primary">
            {prev.title}
          </span>
        </Link>
      ) : (
        <span />
      )}
      {next ? (
        <Link
          href={next.href}
          className="group flex flex-col items-end gap-1.5 rounded-xl border border-primary/40 bg-card/70 p-5 text-right glow-soft transition-all duration-200 hover:-translate-y-0.5 hover:border-primary/70"
        >
          <span className="flex items-center gap-1.5 font-mono text-[11px] uppercase tracking-[0.1em] text-primary">
            Next
            <ArrowRight className="size-3.5 transition-transform duration-200 group-hover:translate-x-0.5" />
          </span>
          <span className="text-[15px] font-semibold text-ink group-hover:text-primary">
            {next.title}
          </span>
        </Link>
      ) : (
        <span />
      )}
    </div>
  );
}
