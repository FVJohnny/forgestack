import Link from 'next/link';
import { useTranslations } from 'next-intl';
import {
  Boxes,
  GitBranch,
  Activity,
  ShieldCheck,
  Bot,
  FlaskConical,
  ArrowRight,
  BookOpen,
  Github,
} from 'lucide-react';
import type { ReactNode } from 'react';
import { BRAND } from '@/lib/brand';
import { Wordmark } from '@/app/shared/ui/wordmark';
import { Button } from '@/app/shared/ui/button';
import { ArchitectureDiagram } from '@/app/shared/components/architecture-diagram';
import { EmberField } from '@/app/shared/ui/ember-field';
import { LanguageSwitcher } from '@/app/shared/ui/language-switcher';

// Each feature card carries the accent of the part of the stack it describes,
// matching the tones used in the architecture diagram. Class strings are
// literal so Tailwind picks them up.
const FEATURE_META = [
  {
    key: 'architecture',
    Icon: Boxes,
    chip: 'border-primary/30 bg-primary/10 text-primary',
    hover: 'hover:border-primary/40',
    wash: 'from-primary/[0.07]',
  },
  {
    key: 'events',
    Icon: GitBranch,
    chip: 'border-amber/30 bg-amber/10 text-amber/90',
    hover: 'hover:border-amber/40',
    wash: 'from-amber/[0.06]',
  },
  {
    key: 'observability',
    Icon: Activity,
    chip: 'border-violet/30 bg-violet/10 text-violet/90',
    hover: 'hover:border-violet/50',
    wash: 'from-violet/10',
  },
  {
    key: 'auth',
    Icon: ShieldCheck,
    chip: 'border-signal-red/30 bg-signal-red/10 text-signal-red/90',
    hover: 'hover:border-signal-red/40',
    wash: 'from-signal-red/[0.06]',
  },
  {
    key: 'agents',
    Icon: Bot,
    chip: 'border-blue/30 bg-blue/10 text-blue/90',
    hover: 'hover:border-blue/50',
    wash: 'from-blue/[0.08]',
  },
  {
    key: 'testing',
    Icon: FlaskConical,
    chip: 'border-pink/30 bg-pink/10 text-pink/90',
    hover: 'hover:border-pink/40',
    wash: 'from-pink/[0.07]',
  },
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
                <Link href="/docs">
                  <BookOpen className="size-4" />
                  {t('seeDocs')}
                </Link>
              </Button>
              <Button asChild variant="outline" size="lg" className="group">
                <Link href="/login">
                  {t('openDemo')}
                  <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" />
                </Link>
              </Button>
            </div>
          </div>

          {/* right: live architecture diagram — min-w-0 lets the grid track
              shrink below the diagram's minimum layout width on phones, where
              the diagram scales itself down to fit */}
          <div className="enter-fade min-w-0" style={{ animationDelay: '360ms' }}>
            <ArchitectureDiagram />
          </div>
        </div>

        {/* feature grid */}
        <div className="mt-16 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURE_META.map(({ key, Icon, chip, hover, wash }, i) => (
            <div
              key={key}
              className={`enter group relative flex flex-col gap-3 overflow-hidden rounded-xl border border-line-strong bg-card/60 p-6 backdrop-blur-sm transition-colors duration-200 ${hover}`}
              style={{ animationDelay: `${360 + i * 70}ms` }}
            >
              {/* per-feature translucent wash, bleeding in from the top-left */}
              <div
                className={`pointer-events-none absolute inset-0 bg-gradient-to-br via-transparent to-transparent ${wash}`}
              />
              <div className="relative flex items-center gap-3">
                <span className={`grid size-9 place-items-center rounded-md border ${chip}`}>
                  <Icon className="size-4" />
                </span>
                <span className="font-mono text-[11px] uppercase tracking-[0.14em] text-ink-faint">
                  {String(i + 1).padStart(2, '0')}
                </span>
              </div>
              <h3 className="relative font-mono text-sm font-semibold text-ink">
                {t(`features.${key}.title`)}
              </h3>
              <p className="relative text-sm leading-relaxed text-ink-dim">
                {t(`features.${key}.desc`)}
              </p>
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
