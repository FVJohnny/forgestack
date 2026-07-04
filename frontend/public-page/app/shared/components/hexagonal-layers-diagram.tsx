'use client';

import { useCallback, useLayoutEffect, useRef, useState } from 'react';
import {
  Globe,
  Radio,
  Database,
  Mail,
  KeyRound,
  DoorOpen,
  Plug,
  Workflow,
  Hexagon,
} from 'lucide-react';

/**
 * Animated diagram of the hexagonal layers inside a bounded context.
 *
 * The hexagon is unrolled along one axis so "inward" is visible: the outside
 * world sits at both ends, the layers narrow as they get deeper, and domain
 * is the literal center. Every arrow converges on it.
 *
 *   ┌───── outside world (HTTP · Kafka) ─────┐
 *                    │ calls in
 *              ┌ interfaces/ ┐
 *                    │ imports
 *               ┌ application/ ┐
 *                    ▼ imports
 *                 ┌ domain/ ┐          ← the center
 *                    ▲ imports (implements its ports)
 *             ┌ infrastructure/ ┐
 *                    │ calls out
 *   └──── outside world (MongoDB · SMTP) ────┘
 *
 * Small squares on the domain border are ports: interfaces the domain owns.
 * The handlers depend on them from above, the adapters implement them from
 * below.
 *
 * Same approach as ArchitectureDiagram: nodes register refs, real box
 * positions are measured relative to the diagram root (re-measured via
 * ResizeObserver), and an SVG overlay draws the connectors between the actual
 * edges, so it stays pixel-correct at any container width.
 */

type NodeRect = {
  left: number;
  top: number;
  right: number;
  bottom: number;
  cx: number;
  cy: number;
  width: number;
  height: number;
};

type Geometry = { w: number; h: number; rects: Record<string, NodeRect> };

function useDiagramGeometry() {
  const rootRef = useRef<HTMLDivElement>(null);
  const nodeRefs = useRef<Record<string, HTMLElement | null>>({});
  const [geo, setGeo] = useState<Geometry | null>(null);

  const register = useCallback(
    (name: string) => (el: HTMLElement | null) => {
      nodeRefs.current[name] = el;
    },
    [],
  );

  useLayoutEffect(() => {
    const root = rootRef.current;
    if (!root) return;

    const measure = () => {
      const rootRect = root.getBoundingClientRect();
      const rects: Record<string, NodeRect> = {};
      for (const [name, el] of Object.entries(nodeRefs.current)) {
        if (!el) continue;
        const r = el.getBoundingClientRect();
        rects[name] = {
          left: r.left - rootRect.left,
          top: r.top - rootRect.top,
          right: r.right - rootRect.left,
          bottom: r.bottom - rootRect.top,
          cx: r.left - rootRect.left + r.width / 2,
          cy: r.top - rootRect.top + r.height / 2,
          width: r.width,
          height: r.height,
        };
      }
      setGeo({ w: rootRect.width, h: rootRect.height, rects });
    };

    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(root);
    for (const el of Object.values(nodeRefs.current)) {
      if (el) ro.observe(el);
    }
    return () => ro.disconnect();
  }, []);

  return { rootRef, register, geo };
}

function Connectors({ geo }: { geo: Geometry }) {
  const g = geo.rects;
  const needed = [
    'outsideTop',
    'interfaces',
    'application',
    'domain',
    'infrastructure',
    'outsideBottom',
  ];
  if (needed.some((n) => !g[n])) return null;

  const ifc = g.interfaces;
  const app = g.application;
  const dom = g.domain;
  const inf = g.infrastructure;
  const outTop = g.outsideTop;
  const outBottom = g.outsideBottom;

  // Everything is stacked on the same center axis, so each row gap carries
  // exactly one straight connector.
  const x = dom.cx;

  // Import arrows converge on the center: down from the driving side, up from
  // the driven side. The two that land on a port stop just short of the
  // square so the arrowhead points at it.
  const imports = [
    `M ${x} ${ifc.bottom} V ${app.top - 1}`,
    `M ${x} ${app.bottom} V ${dom.top - 7}`,
    `M ${x} ${inf.top} V ${dom.bottom + 7}`,
  ];
  // Ports on the domain border: handlers depend on them from above, adapters
  // implement them from below.
  const ports = [dom.top, dom.bottom];

  // Runtime traffic with the outside world: requests and events come in
  // through interfaces; adapters call out to Mongo, SMTP, Google.
  const runtime = [
    `M ${x} ${outTop.bottom} V ${ifc.top - 1}`,
    `M ${x} ${inf.bottom} V ${outBottom.top - 1}`,
  ];

  const rails = [...imports, ...runtime];

  return (
    <svg
      className="pointer-events-none absolute inset-0"
      width={geo.w}
      height={geo.h}
      viewBox={`0 0 ${geo.w} ${geo.h}`}
      fill="none"
    >
      <defs>
        <marker
          id="hex-arrow-import"
          viewBox="0 0 8 8"
          refX="6"
          refY="4"
          markerWidth="6"
          markerHeight="6"
          orient="auto"
        >
          <path d="M0,0 L8,4 L0,8 z" fill="var(--phosphor)" opacity="0.9" />
        </marker>
        <marker
          id="hex-arrow-runtime"
          viewBox="0 0 8 8"
          refX="6"
          refY="4"
          markerWidth="6"
          markerHeight="6"
          orient="auto"
        >
          <path d="M0,0 L8,4 L0,8 z" fill="var(--ink-dim)" opacity="0.8" />
        </marker>
      </defs>

      {rails.map((d, i) => (
        <path key={`rail-${i}`} d={d} className="stroke-line-strong" strokeWidth="1" />
      ))}

      {imports.map((d, i) => (
        <path
          key={`import-${i}`}
          d={d}
          className="stroke-primary/80 dash-flow"
          strokeWidth="1.2"
          strokeDasharray="2 4"
          markerEnd="url(#hex-arrow-import)"
        />
      ))}

      {runtime.map((d, i) => (
        <path
          key={`runtime-${i}`}
          d={d}
          className="stroke-ink-dim/70 dash-flow"
          strokeWidth="1"
          strokeDasharray="3 3"
          markerEnd="url(#hex-arrow-runtime)"
        />
      ))}

      {/* ports: interfaces the domain owns, drawn on its borders */}
      {ports.map((y, i) => (
        <rect
          key={`port-${i}`}
          x={x - 4}
          y={y - 4}
          width="8"
          height="8"
          rx="1.5"
          fill="var(--base-2)"
          stroke="var(--phosphor)"
          strokeOpacity="0.65"
          strokeWidth="1"
        />
      ))}
    </svg>
  );
}

function LayerBox({
  icon: Icon,
  title,
  role,
  contents,
  accent = false,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  role: string;
  contents: string;
  accent?: boolean;
}) {
  return (
    <div
      className={`relative flex items-center justify-center gap-2 rounded-xl border bg-card/80 px-2.5 py-2.5 backdrop-blur-sm sm:gap-3 sm:px-4 sm:py-3 ${
        accent ? 'border-primary/40 glow-soft' : 'border-line-strong'
      }`}
    >
      {/* the icon is the widest non-shrinkable piece; drop it on phones so the
          narrow center boxes keep room for their text */}
      <span
        className={`hidden size-9 shrink-0 place-items-center rounded-md border sm:grid ${
          accent
            ? 'border-primary/50 bg-primary/15 text-primary'
            : 'border-line-strong bg-base-2 text-ink-dim'
        }`}
      >
        <Icon className="size-4" />
      </span>
      <span className="flex min-w-0 flex-col leading-tight">
        <span className="font-mono text-[13px] font-semibold text-ink">{title}</span>
        <span className="font-mono text-[9.5px] uppercase tracking-[0.08em] text-ink-faint">
          {role}
        </span>
        <span className="mt-1 text-[10px] leading-snug text-ink-dim">{contents}</span>
      </span>
    </div>
  );
}

function OutsideChip({
  icon: Icon,
  label,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
}) {
  return (
    <span className="flex items-center gap-1 font-mono text-[10px] text-ink-dim">
      <Icon className="size-3 shrink-0 text-ink-faint" />
      {label}
    </span>
  );
}

function OutsideStrip({
  registerRef,
  children,
}: {
  registerRef: (el: HTMLElement | null) => void;
  children: React.ReactNode;
}) {
  return (
    <div
      ref={registerRef}
      className="rounded-xl border border-dashed border-line-strong px-4 py-2.5"
    >
      <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1">
        <span className="font-mono text-[9.5px] uppercase tracking-[0.12em] text-ink-faint">
          outside world
        </span>
        {children}
      </div>
    </div>
  );
}

function Legend() {
  return (
    <div className="relative mt-7 flex flex-wrap items-center justify-center gap-x-5 gap-y-2 font-mono text-[10px] text-ink-faint">
      <span className="flex items-center gap-1.5">
        <svg width="26" height="8" viewBox="0 0 26 8" fill="none" aria-hidden>
          <path d="M0 4 H19" stroke="var(--phosphor)" strokeWidth="1.2" strokeDasharray="2 3" />
          <path d="M19 1 L25 4 L19 7 z" fill="var(--phosphor)" opacity="0.9" />
        </svg>
        import · points inward
      </span>
      <span className="flex items-center gap-1.5">
        <span className="inline-block size-2 rounded-[2px] border border-primary/60 bg-base-2" />
        port · owned by the domain
      </span>
      <span className="flex items-center gap-1.5">
        <svg width="22" height="8" viewBox="0 0 22 8" fill="none" aria-hidden>
          <path d="M0 4 H21" stroke="var(--ink-dim)" strokeWidth="1" strokeDasharray="3 3" />
        </svg>
        runtime I/O
      </span>
    </div>
  );
}

/** A layer row: centered, with a width that shrinks as the layer gets closer
 *  to the center of the hexagon. */
function LayerRow({ width, children }: { width: string; children: React.ReactNode }) {
  return (
    <div className="mt-9 flex justify-center">
      <div className={`${width} min-w-[250px] max-w-full`}>{children}</div>
    </div>
  );
}

export function HexagonalLayersDiagram() {
  const { rootRef, register, geo } = useDiagramGeometry();

  return (
    <div ref={rootRef} className="relative w-full select-none">
      {/* ambient heat, centered on the domain layer in the middle */}
      <div
        className="pointer-events-none absolute -inset-10"
        style={{
          background:
            'radial-gradient(ellipse 50% 32% at 50% 50%, rgba(255,90,31,0.15), transparent 72%)',
        }}
      />

      <div className="relative">
        {/* the driving side of the outside world: things that call us */}
        <OutsideStrip registerRef={register('outsideTop')}>
          <OutsideChip icon={Globe} label="HTTP" />
          <OutsideChip icon={Radio} label="Kafka" />
        </OutsideStrip>

        <LayerRow width="w-[86%]">
          <div ref={register('interfaces')}>
            <LayerBox
              icon={DoorOpen}
              title="interfaces/"
              role="entry points"
              contents="HTTP controllers · integration-event handlers"
            />
          </div>
        </LayerRow>

        <LayerRow width="w-[70%]">
          <div ref={register('application')}>
            <LayerBox
              icon={Workflow}
              title="application/"
              role="use cases"
              contents="command · query · domain-event handlers"
            />
          </div>
        </LayerRow>

        {/* domain: the center of the hexagon */}
        <LayerRow width="w-[54%]">
          <div ref={register('domain')}>
            <LayerBox
              icon={Hexagon}
              title="domain/"
              role="business logic"
              contents="aggregates · value objects · domain events · ports"
              accent
            />
          </div>
        </LayerRow>

        <LayerRow width="w-[86%]">
          <div ref={register('infrastructure')}>
            <LayerBox
              icon={Plug}
              title="infrastructure/"
              role="adapters"
              contents="Mongo repositories · SMTP client · Google OAuth"
            />
          </div>
        </LayerRow>

        {/* the driven side of the outside world: things we call */}
        <div className="mt-9">
          <OutsideStrip registerRef={register('outsideBottom')}>
            <OutsideChip icon={Database} label="MongoDB" />
            <OutsideChip icon={Mail} label="SMTP" />
            <OutsideChip icon={KeyRound} label="Google OAuth" />
          </OutsideStrip>
        </div>
      </div>

      {geo && <Connectors geo={geo} />}

      <Legend />
    </div>
  );
}
