'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Menu, X, Github, ArrowLeft } from 'lucide-react';
import { BRAND } from '@/lib/brand';
import { Wordmark } from '@/app/shared/ui/wordmark';
import { DocsSidebar } from './docs-sidebar';
import { DocsPager } from './docs-pager';

/**
 * Client shell for the docs section: sticky header, responsive sidebar (static
 * on desktop, slide-over drawer on mobile) and the scrollable content column.
 */
export function DocsShell({ children }: { children: React.ReactNode }) {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <div className="relative min-h-screen bg-background text-foreground">
      {/* faint forge atmosphere */}
      <div className="pointer-events-none fixed inset-0">
        <div className="absolute inset-0 bg-grid opacity-40" />
        <div className="forge-glow absolute inset-x-0 bottom-0 h-[40vh] opacity-50" />
      </div>

      {/* header */}
      <header className="sticky top-0 z-30 border-b border-line bg-background/80 backdrop-blur-md">
        <div className="mx-auto flex h-16 w-full max-w-7xl items-center justify-between gap-3 px-4 md:px-6">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setMenuOpen(true)}
              className="grid size-9 place-items-center rounded-md border border-line-strong text-ink-dim hover:text-ink lg:hidden"
              aria-label="Open navigation"
            >
              <Menu className="size-4" />
            </button>
            <Link href="/" className="flex items-center gap-2.5">
              <Wordmark size="md" showLabel={false} />
              <span className="font-mono text-[11px] uppercase tracking-[0.16em] text-ink-faint">
                Docs
              </span>
            </Link>
          </div>
          <div className="flex items-center gap-2">
            <Link
              href="/"
              className="hidden items-center gap-1.5 rounded-md px-3 py-1.5 font-mono text-[12px] text-ink-dim transition-colors hover:text-ink sm:flex"
            >
              <ArrowLeft className="size-3.5" />
              Home
            </Link>
            <a
              href={BRAND.repoUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 rounded-md border border-line-strong px-3 py-1.5 font-mono text-[12px] text-ink-dim transition-colors hover:text-ink"
            >
              <Github className="size-3.5" />
              GitHub
            </a>
          </div>
        </div>
      </header>

      <div className="relative mx-auto flex w-full max-w-7xl gap-8 px-4 md:px-6">
        {/* desktop sidebar */}
        <aside className="sticky top-16 hidden h-[calc(100vh-4rem)] w-60 shrink-0 overflow-y-auto py-6 pr-2 lg:block">
          <DocsSidebar />
        </aside>

        {/* mobile drawer */}
        {menuOpen && (
          <div className="fixed inset-0 z-40 lg:hidden">
            <div
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
              onClick={() => setMenuOpen(false)}
            />
            <div className="absolute left-0 top-0 h-full w-72 overflow-y-auto border-r border-line bg-base p-6">
              <div className="mb-6 flex items-center justify-between">
                <Wordmark size="sm" showLabel={false} />
                <button
                  type="button"
                  onClick={() => setMenuOpen(false)}
                  className="grid size-8 place-items-center rounded-md text-ink-dim hover:text-ink"
                  aria-label="Close navigation"
                >
                  <X className="size-4" />
                </button>
              </div>
              <DocsSidebar onNavigate={() => setMenuOpen(false)} />
            </div>
          </div>
        )}

        {/* content */}
        <main className="min-w-0 flex-1 py-10 lg:py-12">
          <article className="mx-auto max-w-3xl">
            {children}
            <DocsPager />
          </article>
        </main>
      </div>
    </div>
  );
}
