import type { CSSProperties } from 'react';
import { cn } from '@/lib/utils';
import { BRAND } from '@/lib/brand';

/** Independent sparks rising off the glyph — each starts somewhere across the
 *  F's body (left/top) and rises up through and above it (--rise), with its own
 *  delay, speed and horizontal drift so the whole glyph reads as continuously
 *  alight rather than a stuck bunch at the bottom. */
const LOGO_SPARKS: {
  left: string;
  top: string;
  delay: string;
  dur: string;
  drift: string;
  rise: string;
}[] = [
  { left: '36%', top: '80%', delay: '0s', dur: '2.4s', drift: '-4px', rise: '-72px' },
  { left: '50%', top: '88%', delay: '-0.4s', dur: '2.9s', drift: '3px', rise: '-84px' },
  { left: '62%', top: '72%', delay: '-0.8s', dur: '2.6s', drift: '5px', rise: '-66px' },
  { left: '44%', top: '64%', delay: '-1.2s', dur: '3.1s', drift: '-3px', rise: '-60px' },
  { left: '56%', top: '84%', delay: '-1.6s', dur: '2.5s', drift: '2px', rise: '-78px' },
  { left: '40%', top: '76%', delay: '-2s', dur: '2.8s', drift: '-5px', rise: '-70px' },
  { left: '58%', top: '60%', delay: '-2.4s', dur: '2.7s', drift: '4px', rise: '-58px' },
  { left: '48%', top: '92%', delay: '-1s', dur: '3s', drift: '-2px', rise: '-88px' },
];

/**
 * The brand mark: a phosphor glyph in a bracketed monogram + optional wordmark.
 * Kept purely presentational so it reads identically in nav, auth, and landing.
 */
export function Wordmark({
  showName = true,
  showLabel = true,
  className,
  size = 'md',
}: {
  showName?: boolean;
  showLabel?: boolean;
  className?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
}) {
  const s = {
    sm: { glyph: 'h-7 w-7', name: 'text-sm', label: 'text-[10px]', gap: 'gap-2.5' },
    md: { glyph: 'h-8 w-8', name: 'text-sm', label: 'text-[10px]', gap: 'gap-2.5' },
    lg: { glyph: 'h-10 w-10', name: 'text-base', label: 'text-[11px]', gap: 'gap-3' },
    xl: { glyph: 'h-20 w-20', name: 'text-4xl', label: 'text-sm', gap: 'gap-5' },
  }[size];

  return (
    <span className={cn('inline-flex items-center select-none', s.gap, className)}>
      {/* brand mark — same SVG asset as the favicon, with embers rising off it */}
      <span className={cn('relative inline-block', s.glyph)}>
        <span className="ember-source" aria-hidden>
          {LOGO_SPARKS.map((sp, i) => (
            <span
              key={i}
              className="spark"
              style={
                {
                  left: sp.left,
                  top: sp.top,
                  animationDelay: sp.delay,
                  animationDuration: sp.dur,
                  '--drift': sp.drift,
                  '--rise': sp.rise,
                } as CSSProperties
              }
            />
          ))}
        </span>
        <img
          src="/icon.svg"
          alt={`${BRAND.short} logo`}
          className={cn(
            'relative h-full w-full [filter:drop-shadow(0_0_10px_rgba(255,90,31,0.45))]',
          )}
        />
      </span>
      {showName && (
        <span className="flex flex-col leading-none">
          <span className={cn('font-mono font-semibold tracking-tight text-ink', s.name)}>
            {BRAND.short}
          </span>
          {showLabel && (
            <span className={cn('mt-1 font-mono tracking-[0.1em] text-ink-faint', s.label)}>
              {BRAND.label}
            </span>
          )}
        </span>
      )}
    </span>
  );
}
