'use client';

import Link from 'next/link';
import { useCallback, useLayoutEffect, useRef, useState } from 'react';
import {
  Globe,
  ShieldHalf,
  MonitorSmartphone,
  Box,
  Database,
  Layers,
  GaugeCircle,
  Table,
  Radio,
  ArrowUpRight,
} from 'lucide-react';

/**
 * Live, animated architecture diagram.
 *
 *   Browser ─▶ Caddy ─▶ Frontend
 *                   └──▶ Services ──┬─▶ Redis
 *                     ▲   │         ├─▶ Database (Mongo / Postgres / MySQL)
 *                     └───┘ Kafka   └─▶ Monitoring ─▶ Grafana
 *                   (events loop back between services)
 *
 * Forged-steel nodes, ember connectors, dotted animated event arrows.
 *
 * The connectors are NOT hardcoded: every node registers a ref, the real box
 * positions are measured relative to the diagram root (re-measured via
 * ResizeObserver), and a single SVG overlay draws the lines between the actual
 * edges. That way the diagram stays pixel-correct in any container at any
 * screen size — landing hero, docs prose column, mobile, anywhere.
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

/** Registers named node elements and measures their boxes relative to the
 *  diagram root. Re-measures whenever the root or any node resizes. */
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

/** The SVG overlay that draws every connector between the measured node boxes.
 *  Coordinates are in pixels of the diagram root, so the dash animation scale
 *  is identical for all lines at any container width. */
function Connectors({ geo }: { geo: Geometry }) {
  const g = geo.rects;
  const needed = [
    'browser',
    'caddy',
    'dbviewers',
    'backend',
    'frontend',
    'grafana',
    'databases',
    'kafka',
    'monitoring',
  ];
  if (needed.some((n) => !g[n])) return null;

  // Horizontal bars sit a little below the box they fan out from.
  const fanBarY = g.caddy.bottom + 14;
  const storesBarY = g.backend.bottom + 14;

  // Browser → Caddy: the single entry drop.
  const entry = `M ${g.browser.cx} ${g.browser.bottom} V ${g.caddy.top}`;

  const orange = [
    // Caddy fans out to the four browser-facing boxes.
    ...(['dbviewers', 'backend', 'frontend', 'grafana'] as const).map(
      (t) => `M ${g.caddy.cx} ${g.caddy.bottom} V ${fanBarY} H ${g[t].cx} V ${g[t].top}`,
    ),
    // Backend → Databases. Enters offset from the column center so it doesn't
    // overlap the vertical riser that runs there.
    `M ${g.backend.cx - 30} ${g.backend.bottom} V ${storesBarY} H ${g.databases.cx + 18} V ${g.databases.top}`,
  ];

  // Telemetry feeds into Monitoring — cooler steel tone so they read as
  // observability exhaust, not request traffic.
  const telemetry = [
    // Backend → Monitoring (enters offset from the Grafana riser).
    `M ${g.backend.cx + 30} ${g.backend.bottom} V ${storesBarY} H ${g.monitoring.cx - 22} V ${g.monitoring.top}`,
    // Kafka → Monitoring: events feed the observability stack.
    `M ${g.kafka.right} ${g.kafka.top + g.kafka.height * 0.55} H ${g.monitoring.left}`,
    // Databases → Monitoring: DB metrics scraped into observability.
    `M ${g.databases.right} ${g.databases.bottom - 18} H ${g.monitoring.left}`,
  ];

  // Store → viewer risers; the pulse travels upward via dash-flow-rev.
  const risers = [
    `M ${g.dbviewers.cx} ${g.dbviewers.bottom} V ${g.databases.top}`, // Databases → DB Viewers
    `M ${g.grafana.cx} ${g.grafana.bottom} V ${g.monitoring.top}`, // Monitoring → Grafana
  ];

  // Bidirectional Backend ↔ Kafka event link (publish down, consume up).
  const amber = [
    `M ${g.backend.cx - 3} ${g.backend.bottom} V ${g.kafka.top}`,
    `M ${g.backend.cx + 3} ${g.kafka.top} V ${g.backend.bottom}`,
  ];

  const rails = [entry, ...orange, ...telemetry, ...risers];

  return (
    <svg
      className="pointer-events-none absolute inset-0"
      width={geo.w}
      height={geo.h}
      viewBox={`0 0 ${geo.w} ${geo.h}`}
      fill="none"
    >
      {rails.map((d, i) => (
        <path key={`rail-${i}`} d={d} className="stroke-line-strong" strokeWidth="1" />
      ))}
      <path
        d={entry}
        className="stroke-primary/80 dash-flow"
        strokeWidth="1.4"
        strokeDasharray="2 4"
      />
      {orange.map((d, i) => (
        <path
          key={`flow-${i}`}
          d={d}
          className="stroke-primary/80 dash-flow"
          strokeWidth="1"
          strokeDasharray="2 4"
        />
      ))}
      {telemetry.map((d, i) => (
        <path
          key={`telemetry-${i}`}
          d={d}
          className="stroke-ink-dim/70 dash-flow"
          strokeWidth="1"
          // "3 3" keeps the dash period at 6 so the shared dash-flow animation
          // (which travels 12 per loop) stays perfectly seamless.
          strokeDasharray="3 3"
        />
      ))}
      {risers.map((d, i) => (
        <path
          key={`riser-${i}`}
          d={d}
          className="stroke-heat-1 dash-flow-rev"
          strokeWidth="1"
          strokeDasharray="2 4"
        />
      ))}
      {amber.map((d, i) => (
        <path
          key={`amber-${i}`}
          d={d}
          className="stroke-amber/70 dash-flow"
          strokeWidth="1.4"
          strokeDasharray="2 4"
        />
      ))}
    </svg>
  );
}

/**
 * Wraps a diagram node/cluster so it links to its docs page. On hover the box
 * border lights up (molten) and a small "Docs →" hint fades in at the top-right
 * — the hint is absolutely positioned so it never shifts the layout. When no
 * href is given it renders a plain, non-interactive box.
 */
function DocLinkWrapper({
  href,
  className = '',
  children,
}: {
  href?: string;
  className?: string;
  children: React.ReactNode;
}) {
  if (!href) {
    return <div className={`group/node relative ${className}`}>{children}</div>;
  }
  return (
    <Link
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className={`group/node relative block cursor-pointer rounded-xl outline-none transition-transform duration-200 hover:-translate-y-0.5 focus-visible:ring-2 focus-visible:ring-primary/60 ${className}`}
    >
      {children}
      {/* hover hint: a subtle arrow inside the card's top-right corner */}
      <ArrowUpRight className="pointer-events-none absolute right-2 top-2 z-10 size-3 text-primary opacity-0 transition-opacity duration-200 group-hover/node:opacity-70" />
    </Link>
  );
}

function Node({
  icon: Icon,
  label,
  sub,
  className = '',
  accent = false,
  href,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  sub?: string;
  className?: string;
  accent?: boolean;
  href?: string;
}) {
  return (
    <DocLinkWrapper href={href} className={className}>
      <div
        className={`relative flex items-center gap-2.5 rounded-lg border bg-card/90 px-3.5 py-3 backdrop-blur-sm transition-colors duration-200 ${
          accent ? 'border-primary/40 glow-soft' : 'border-line-strong'
        } ${href ? 'group-hover/node:border-primary/60 group-hover/node:glow-soft' : ''} ${className}`}
      >
        <span
          className={`grid size-8 shrink-0 place-items-center rounded-md border transition-colors duration-200 ${
            accent
              ? 'border-primary/50 bg-primary/15 text-primary'
              : 'border-line-strong bg-base-2 text-ink-dim'
          } ${href ? 'group-hover/node:border-primary/50 group-hover/node:bg-primary/15 group-hover/node:text-primary' : ''}`}
        >
          <Icon className="size-4" />
        </span>
        <span className="flex flex-col leading-tight">
          <span className="whitespace-nowrap font-mono text-[13px] font-semibold text-ink">
            {label}
          </span>
          {sub && (
            <span className="whitespace-nowrap font-mono text-[9.5px] uppercase tracking-[0.08em] text-ink-faint">
              {sub}
            </span>
          )}
        </span>
      </div>
    </DocLinkWrapper>
  );
}

export function ArchitectureDiagram() {
  const { rootRef, register, geo } = useDiagramGeometry();

  return (
    <div ref={rootRef} className="relative w-full select-none">
      {/* ambient heat behind the diagram — centered radial that fades out on all
          sides so it never hard-clips against the next section's background */}
      <div
        className="pointer-events-none absolute -inset-10"
        style={{
          background:
            'radial-gradient(ellipse 55% 45% at 50% 45%, rgba(255,90,31,0.16), transparent 72%)',
        }}
      />

      <div className="relative">
        {/* Row 1: Browser */}
        <div className="flex justify-center">
          <div ref={register('browser')}>
            <Node icon={Globe} label="Browser" sub="client" href="/docs/architecture" />
          </div>
        </div>

        {/* Row 2: Caddy (entry / TLS) — the mt gaps between rows leave room for
            the measured connector lines drawn by the overlay. */}
        <div className="mt-10 flex justify-center">
          <div ref={register('caddy')}>
            <Node
              icon={ShieldHalf}
              label="Caddy"
              sub="reverse proxy · TLS"
              href="/docs/deployment"
            />
          </div>
        </div>

        {/* Row 3: the four browser-facing app-row peers (all reached through
            Caddy): DB Viewers · Backend · Frontend · Grafana. */}
        <div className="mt-12 grid grid-cols-[minmax(118px,1fr)_minmax(120px,1.3fr)_minmax(108px,0.8fr)_minmax(132px,1fr)] items-start gap-3">
          <div ref={register('dbviewers')}>
            <DbViewerCluster />
          </div>
          <div ref={register('backend')}>
            <ServicesCluster />
          </div>
          <div ref={register('frontend')}>
            <Node
              icon={MonitorSmartphone}
              label="Frontend"
              sub="Next.js"
              className="justify-center"
              href="/docs/frontend"
            />
          </div>
          <div ref={register('grafana')}>
            <Node
              icon={GaugeCircle}
              label="Grafana"
              sub="dashboards"
              className="justify-center"
              href="/docs/monitoring"
            />
          </div>
        </div>

        {/* Row 4: the stores, mirroring the app-row grid so each sits directly
            under its counterpart: Databases under DB Viewers, Kafka under
            Backend, Monitoring under Grafana. */}
        <div className="mt-12 grid grid-cols-[minmax(118px,1fr)_minmax(120px,1.3fr)_minmax(108px,0.8fr)_minmax(132px,1fr)] items-start gap-3">
          <div ref={register('databases')}>
            <DatabasesCluster />
          </div>
          <div ref={register('kafka')}>
            <KafkaCluster />
          </div>
          <div aria-hidden />
          <div ref={register('monitoring')}>
            <MonitoringCluster />
          </div>
        </div>
      </div>

      {/* All connector lines, drawn between the measured box edges. */}
      {geo && <Connectors geo={geo} />}
    </div>
  );
}

/** A single service row — a NestJS service (full width, stacked layout). */
function ServiceChip({ n }: { n: number }) {
  return (
    <div className="flex items-center gap-1.5 rounded-md border border-line-strong bg-base-2 px-1.5 py-1.5">
      <Box className="size-3 shrink-0 text-ink-dim" />
      <span className="whitespace-nowrap font-mono text-[10px] font-semibold leading-tight text-ink">
        service-{n}
      </span>
    </div>
  );
}

/**
 * Compact Backend cluster: service-1/2/3 stacked vertically. The bidirectional
 * event link down to Kafka is drawn by the Connectors overlay.
 */
function ServicesCluster() {
  return (
    <DocLinkWrapper href="/docs/backend">
      <div className="relative flex flex-col gap-2 rounded-xl border border-line-strong bg-card/70 p-3 backdrop-blur-sm transition-colors duration-200 group-hover/node:border-primary/60 group-hover/node:glow-soft">
        <span className="flex flex-col items-center leading-tight">
          <span className="font-mono text-[13px] font-semibold text-ink">Backend</span>
          <span className="font-mono text-[9.5px] uppercase tracking-[0.08em] text-ink-faint">
            NestJS
          </span>
        </span>

        {/* stacked service nodes */}
        <div className="flex flex-col gap-1.5">
          <ServiceChip n={1} />
          <ServiceChip n={2} />
          <ServiceChip n={3} />
        </div>
      </div>
    </DocLinkWrapper>
  );
}

/** Kafka cluster: the event bus, sitting in the bottom row beside the
 *  databases. */
function KafkaCluster() {
  return (
    <StackCluster
      title="Event Bus"
      sub="Kafka"
      icon={Radio}
      items={['topics']}
      href="/docs/backend/events"
    />
  );
}

/** A single stacked row inside a cluster (matches the Backend service chips).
 *  Labels wrap to a second line rather than truncate so multi-word names like
 *  "Mongo Express" stay fully readable. */
function StackChip({
  name,
  icon: Icon,
}: {
  name: string;
  icon: React.ComponentType<{ className?: string }>;
}) {
  return (
    <div className="flex items-center gap-1.5 rounded-md border border-line-strong bg-base-2 px-1.5 py-1.5">
      <Icon className="size-3 shrink-0 text-ink-dim" />
      <span className="min-w-0 font-mono text-[10px] font-semibold leading-tight text-ink">
        {name}
      </span>
    </div>
  );
}

/** A vertical cluster: a titled box with stacked component chips — the shared
 *  shape behind Databases, Monitoring and DB Viewer. */
function StackCluster({
  title,
  sub,
  icon,
  items,
  href,
}: {
  title: string;
  sub?: string;
  icon: React.ComponentType<{ className?: string }>;
  items: string[];
  href?: string;
}) {
  return (
    <DocLinkWrapper href={href}>
      <div
        className={`relative flex w-full flex-col gap-2 rounded-xl border border-line-strong bg-card/70 p-3 backdrop-blur-sm transition-colors duration-200 ${
          href ? 'group-hover/node:border-primary/60 group-hover/node:glow-soft' : ''
        }`}
      >
        <span className="flex flex-col items-center leading-tight">
          <span className="font-mono text-[13px] font-semibold text-ink">{title}</span>
          {sub && (
            <span className="font-mono text-[9.5px] uppercase tracking-[0.08em] text-ink-faint">
              {sub}
            </span>
          )}
        </span>
        <div className="flex flex-col gap-1.5">
          {items.map((name) => (
            <StackChip key={name} name={name} icon={icon} />
          ))}
        </div>
      </div>
    </DocLinkWrapper>
  );
}

/** Databases cluster: the swappable datastores behind the services. */
function DatabasesCluster() {
  return (
    <StackCluster
      title="Databases"
      sub="datastores"
      icon={Database}
      items={['Redis', 'Mongo', 'PostgreSQL']}
      href="/docs/databases"
    />
  );
}

/** Monitoring cluster: the observability stack feeding Grafana. */
function MonitoringCluster() {
  return (
    <StackCluster
      title="Monitoring"
      sub="observability"
      icon={Layers}
      items={['Prometheus', 'Promtail', 'Loki', 'Tempo']}
      href="/docs/monitoring"
    />
  );
}

/** DB Viewers cluster: the browser-facing DB admin UIs (reached through Caddy). */
function DbViewerCluster() {
  return (
    <StackCluster
      title="DB Viewers"
      icon={Table}
      items={['Mongo Express', 'PGAdmin']}
      href="/docs/databases"
    />
  );
}
