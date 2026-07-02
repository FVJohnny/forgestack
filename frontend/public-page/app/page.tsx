import Link from 'next/link';
import { useTranslations } from 'next-intl';
import {
  Boxes,
  GitBranch,
  Activity,
  PackagePlus,
  Bot,
  Rocket,
  ArrowRight,
  Github,
} from 'lucide-react';
import type { ReactNode } from 'react';
import { BRAND } from '@/lib/brand';
import { Wordmark } from '@/app/shared/ui/wordmark';
import { Button } from '@/app/shared/ui/button';
import { ArchitectureDiagram } from '@/app/shared/components/architecture-diagram';
import { EmberField } from '@/app/shared/ui/ember-field';
import { LanguageSwitcher } from '@/app/shared/ui/language-switcher';

const FEATURE_META = [
  { key: 'ddd', Icon: Boxes },
  { key: 'events', Icon: GitBranch },
  { key: 'observability', Icon: Activity },
  { key: 'deployable', Icon: Rocket },
  { key: 'agents', Icon: Bot },
  { key: 'scaffold', Icon: PackagePlus },
] as const;

export default function Home() {
  const t = useTranslations('fmf.landing');

  return (
    <main className="relative min-h-screen overflow-hidden bg-background text-foreground">
      {/* atmosphere */}
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute inset-0 bg-grid opacity-70" />
        <div className="absolute -top-48 left-1/2 h-[640px] w-[640px] -translate-x-1/2 rounded-full bg-primary/8 blur-[160px]" />
        <div className="absolute bottom-[-10rem] right-[-6rem] h-[460px] w-[460px] rounded-full bg-primary/5 blur-[130px]" />
        {/* forge fire rising from beneath the page */}
        <div className="forge-glow absolute inset-x-0 bottom-0 h-[70vh]" />
        {/* continuous rising embers over the hero */}
        <EmberField className="pointer-events-none absolute inset-0" />
        <div className="grain" />
      </div>

      {/* top bar */}
      <header className="relative z-10 mx-auto flex w-full max-w-6xl items-center justify-between px-6 py-6">
        <Wordmark size="xl" showLabel={false} />
        <div className="flex items-center gap-2">
          <Link
            href="/docs"
            className="rounded-md px-3 py-1.5 font-mono text-sm text-ink-dim transition-colors hover:text-ink"
          >
            {t('docs')}
          </Link>
          <LanguageSwitcher />
        </div>
      </header>

      {/* hero */}
      <section className="relative z-10 mx-auto w-full max-w-6xl px-6 pt-2 pb-20 md:pt-6">
        <div className="grid items-center gap-12 lg:grid-cols-[1.05fr_0.95fr]">
          {/* left: copy */}
          <div>
            <h1
              className="enter text-balance text-4xl font-semibold leading-[1.05] tracking-tight text-ink sm:text-5xl md:text-6xl"
              style={{ animationDelay: '120ms' }}
            >
              {t.rich('headline', {
                molten: (chunks: ReactNode) => <span className="text-molten">{chunks}</span>,
              })}
            </h1>

            <p
              className="enter mt-6 max-w-xl text-pretty text-base leading-relaxed text-ink-dim md:text-lg"
              style={{ animationDelay: '200ms' }}
            >
              {t('sub')}
            </p>

            <div
              className="enter mt-9 flex flex-wrap items-center gap-3"
              style={{ animationDelay: '280ms' }}
            >
              <Button asChild size="lg" className="group">
                <a href={BRAND.repoUrl} target="_blank" rel="noopener noreferrer">
                  <Github className="size-4" />
                  {t('github')}
                </a>
              </Button>
              <Button asChild variant="outline" size="lg" className="group">
                <Link href="/login">
                  {t('openDemo')}
                  <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" />
                </Link>
              </Button>
            </div>
          </div>

          {/* right: live architecture diagram */}
          <div className="enter-fade" style={{ animationDelay: '360ms' }}>
            <ArchitectureDiagram />
          </div>
        </div>

        {/* feature grid */}
        <div className="mt-16 grid grid-cols-1 gap-px overflow-hidden rounded-lg border border-line bg-line sm:grid-cols-2 lg:grid-cols-3">
          {FEATURE_META.map(({ key, Icon }, i) => (
            <div
              key={key}
              className="enter group relative flex flex-col gap-3 bg-card p-6 transition-colors hover:bg-elevated-2"
              style={{ animationDelay: `${360 + i * 70}ms` }}
            >
              <div className="flex items-center gap-3">
                <span className="grid size-9 place-items-center rounded-md border border-line-strong bg-base-2 text-primary transition-colors group-hover:glow-soft">
                  <Icon className="size-4" />
                </span>
                <span className="font-mono text-[11px] uppercase tracking-[0.14em] text-ink-faint">
                  {String(i + 1).padStart(2, '0')}
                </span>
              </div>
              <h3 className="font-mono text-sm font-semibold text-ink">
                {t(`features.${key}.title`)}
              </h3>
              <p className="text-sm leading-relaxed text-ink-dim">{t(`features.${key}.desc`)}</p>
            </div>
          ))}
        </div>
      </section>

      <footer className="relative z-10 mx-auto w-full max-w-6xl px-6 pb-8">
        <div className="flex items-center border-t border-line pt-6">
          <span className="font-mono text-xs text-ink-faint">{BRAND.name}</span>
        </div>
      </footer>
    </main>
  );
}
