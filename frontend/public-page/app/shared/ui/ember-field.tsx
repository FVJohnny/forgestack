import type { CSSProperties } from 'react';

/**
 * A full-bleed, continuous field of rising forge embers. Each spark is an
 * independent dot with its own column, size, speed, delay and drift, so the
 * field reads as a steady shower of sparks rather than synchronized waves.
 * Pure CSS animation (the `ember-rise-spark` keyframe in globals.css); no JS.
 */

// Deterministic pseudo-random so SSR and client markup match (no hydration
// mismatch) — a tiny LCG seeded per index.
function rand(seed: number) {
  const x = Math.sin(seed * 12.9898) * 43758.5453;
  return x - Math.floor(x);
}

const COLORS = [
  'rgba(220, 70, 20, 1)',
  'rgba(200, 60, 15, 1)',
  'rgba(235, 90, 30, 1)',
  'rgba(190, 55, 20, 1)',
  'rgba(245, 110, 45, 0.95)',
];

const COUNT = 34;

const SPARKS = Array.from({ length: COUNT }, (_, i) => {
  const left = rand(i + 1) * 100;
  const size = 1 + rand(i + 7) * 1.8;
  const dur = 7 + rand(i + 13) * 8; // 7–15s
  const delay = -rand(i + 19) * dur; // spread across the cycle
  const drift = (rand(i + 23) - 0.5) * 60; // -30..30px lateral
  const color = COLORS[Math.floor(rand(i + 29) * COLORS.length)];
  const startY = 10 + rand(i + 31) * 90; // start somewhere in lower 100%
  return { left, size, dur, delay, drift, color, startY };
});

export function EmberField({ className }: { className?: string }) {
  return (
    <div className={className} aria-hidden>
      {SPARKS.map((s, i) => (
        <span
          key={i}
          className="ember-spark"
          style={
            {
              left: `${s.left}%`,
              top: `${s.startY}%`,
              width: `${s.size}px`,
              height: `${s.size}px`,
              background: s.color,
              boxShadow: `0 0 ${s.size}px 0 ${s.color}`,
              animationDuration: `${s.dur}s`,
              animationDelay: `${s.delay}s`,
              '--drift': `${s.drift}px`,
            } as CSSProperties
          }
        />
      ))}
    </div>
  );
}
