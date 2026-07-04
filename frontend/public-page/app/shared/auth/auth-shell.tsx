'use client';

import type { ReactNode } from 'react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { Anvil } from 'lucide-react';
import { BRAND } from '@/lib/brand';
import { Wordmark } from '@/app/shared/ui/wordmark';
import { LanguageSwitcher } from '@/app/shared/ui/language-switcher';

/**
 * Asymmetric split auth layout: phosphor-lit marketing panel on the left,
 * the form on the right. Used by login / register / forgot / reset / verify.
 */
export function AuthShell({ children }: { children: ReactNode }) {
  const t = useTranslations('fmf.auth');
  const stack = t.raw('panelStack') as string[];

  return (
    <div className="grid min-h-screen w-full lg:grid-cols-[1.05fr_1fr]">
      {/* ── Brand / marketing panel ── */}
      <aside className="relative hidden overflow-hidden border-r border-line bg-base-2 lg:flex lg:flex-col lg:justify-between lg:p-12">
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute inset-0 bg-grid opacity-80" />
          <div className="absolute -top-32 -left-24 h-[460px] w-[460px] rounded-full bg-primary/10 blur-[150px]" />
          <div className="absolute bottom-0 right-0 h-[360px] w-[360px] rounded-full bg-primary/6 blur-[120px]" />
          {/* forge heat rising from the base of the panel */}
          <div className="forge-glow absolute inset-x-0 bottom-0 h-[55%]" />
          {/* drifting embers */}
          <div className="embers absolute inset-0" />
          {/* oscilloscope scanline */}
          <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-primary/50 to-transparent scanline" />
          <div className="grain" />
        </div>

        <div className="relative z-10">
          <Wordmark size="lg" />
        </div>

        <div className="relative z-10 max-w-md">
          <span className="inline-flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.18em] text-primary/80">
            <Anvil className="size-3.5 text-primary text-phosphor-glow" />
            {t('panelKicker')}
          </span>
          <h2 className="mt-4 text-balance text-3xl font-semibold leading-tight tracking-tight text-ink">
            {t('panelTitle')}
          </h2>
          <div className="mt-7 flex flex-wrap gap-2">
            {stack.map((s) => (
              <span
                key={s}
                className="rounded-md border border-line-strong bg-white/5 px-2.5 py-1 font-mono text-[11px] tracking-tight text-ink-dim"
              >
                {s}
              </span>
            ))}
          </div>
        </div>

        <div className="relative z-10 flex items-center gap-2 font-mono text-xs text-ink-faint">
          <span className="dot dot-live" />
          {t('panelFootnote')}
        </div>
      </aside>

      {/* ── Form panel ── */}
      <main className="relative flex flex-col bg-background">
        <div className="flex items-center justify-between px-6 py-6 lg:px-10">
          <Link href="/" className="lg:hidden">
            <Wordmark />
          </Link>
          <span className="hidden font-mono text-xs text-ink-faint lg:block">{BRAND.short}</span>
          <LanguageSwitcher />
        </div>

        <div className="flex flex-1 items-center justify-center px-6 pb-16 lg:px-10">
          <div className="enter w-full max-w-md">{children}</div>
        </div>

        <div className="px-6 pb-8 lg:px-10">
          <Link
            href="/"
            className="font-mono text-xs text-ink-faint transition-colors hover:text-primary"
          >
            ← {t('backToHome')}
          </Link>
        </div>
      </main>
    </div>
  );
}
