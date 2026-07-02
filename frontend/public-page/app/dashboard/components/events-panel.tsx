'use client';

import { useMemo } from 'react';
import { useFormatter, useTranslations } from 'next-intl';
import { Card } from '@/app/shared/ui/card';
import { Badge } from '@/app/shared/ui/badge';
import { Skeleton } from '@/app/shared/ui/skeleton';
import { FormAlert } from '@/app/shared/ui/form-alert';
import type { DashboardEventsResponse, EventTypeStat } from '@/lib/api/types';

function EventRow({ stat, max }: { stat: EventTypeStat; max: number }) {
  const t = useTranslations('fmf.dashboard.events');
  const format = useFormatter();
  const total = stat.successCount + stat.failureCount;
  const successPct = max > 0 ? (stat.successCount / max) * 100 : 0;
  const failPct = max > 0 ? (stat.failureCount / max) * 100 : 0;

  return (
    <li className="rounded-md border border-line bg-base-2/40 px-3.5 py-3">
      <div className="flex items-center justify-between gap-3">
        <span className="truncate font-mono text-[13px] text-ink">{stat.eventName}</span>
        <span className="flex shrink-0 items-center gap-3 font-mono text-[11px] tabular">
          <span className="text-primary">
            {t('success')} {format.number(stat.successCount)}
          </span>
          <span className={stat.failureCount > 0 ? 'text-[var(--red)]' : 'text-ink-faint'}>
            {t('failure')} {format.number(stat.failureCount)}
          </span>
        </span>
      </div>

      {/* stacked bar */}
      <div className="mt-2 flex h-1.5 w-full overflow-hidden rounded-full bg-white/[0.04]">
        <span
          className="bar-grow bar-heat h-full"
          style={{ width: `${successPct}%`, boxShadow: '0 0 8px rgba(255,90,31,0.45)' }}
        />
        <span
          className="bar-grow h-full bg-[var(--red)]"
          style={{ width: `${failPct}%`, animationDelay: '120ms' }}
        />
      </div>

      <div className="mt-2 flex items-center justify-between font-mono text-[10px] uppercase tracking-[0.1em] text-ink-faint">
        <span>
          {t('topic')}: {stat.topic}
        </span>
        <span>
          {t('lastProcessed')}:{' '}
          {stat.lastProcessed
            ? format.dateTime(new Date(stat.lastProcessed), {
                month: 'short',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
              })
            : t('never')}
          {' · '}
          {total}
        </span>
      </div>
    </li>
  );
}

export function EventsPanel({
  data,
  loading,
  error,
}: {
  data: DashboardEventsResponse | null;
  loading: boolean;
  error: boolean;
}) {
  const t = useTranslations('fmf.dashboard.events');
  const format = useFormatter();

  const { grouped, max } = useMemo(() => {
    const events = data?.eventsByType ?? [];
    const m = Math.max(1, ...events.map((e) => e.successCount + e.failureCount));
    const byTopic = new Map<string, EventTypeStat[]>();
    for (const e of events) {
      const list = byTopic.get(e.topic) ?? [];
      list.push(e);
      byTopic.set(e.topic, list);
    }
    return { grouped: Array.from(byTopic.entries()), max: m };
  }, [data]);

  return (
    <Card className="enter gap-0 py-0" style={{ animationDelay: '140ms' }}>
      <div className="flex items-center justify-between border-b border-line px-5 py-4">
        <h2 className="font-mono text-[13px] font-semibold uppercase tracking-[0.12em] text-ink">
          {t('title')}
        </h2>
      </div>

      <div className="px-5 py-5">
        {error && <FormAlert kind="error">{t('loadError')}</FormAlert>}

        {!error && (
          <>
            {/* hero number */}
            <div className="mb-6">
              <span className="font-mono text-[11px] uppercase tracking-[0.14em] text-ink-faint">
                {t('totalProcessed')}
              </span>
              <div className="mt-1 flex items-baseline gap-2">
                {loading && !data ? (
                  <Skeleton className="h-9 w-32" />
                ) : (
                  <span className="font-mono text-4xl font-semibold tabular text-phosphor-glow">
                    {format.number(data?.totalEventsProcessed ?? 0)}
                  </span>
                )}
              </div>
            </div>

            <p className="mb-3 font-mono text-[11px] uppercase tracking-[0.14em] text-ink-faint">
              {t('byType')}
            </p>

            {loading && !data ? (
              <div className="space-y-2">
                {Array.from({ length: 3 }).map((_, i) => (
                  <Skeleton key={i} className="h-16" />
                ))}
              </div>
            ) : grouped.length === 0 ? (
              <p className="font-mono text-sm text-ink-dim">{t('none')}</p>
            ) : (
              <div className="space-y-5">
                {grouped.map(([topic, stats]) => (
                  <div key={topic}>
                    <div className="mb-2 flex items-center gap-2">
                      <Badge variant="accent">{topic}</Badge>
                      <span className="h-px flex-1 bg-line" />
                    </div>
                    <ul className="space-y-2">
                      {stats.map((s) => (
                        <EventRow key={`${topic}:${s.eventName}`} stat={s} max={max} />
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </Card>
  );
}
