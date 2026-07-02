'use client';

import { useMemo } from 'react';
import { useFormatter, useTranslations } from 'next-intl';
import { Card } from '@/app/shared/ui/card';
import { Badge } from '@/app/shared/ui/badge';
import { Skeleton } from '@/app/shared/ui/skeleton';
import { FormAlert } from '@/app/shared/ui/form-alert';
import type { ActivitySummaryResponse } from '@/lib/api/types';

/**
 * User-activity panel fed by service-2's analytics context — the same numbers
 * the events panel shows from service-1's side, but rebuilt independently by a
 * second service consuming the Kafka stream. Two services, one event flow.
 */
export function AnalyticsPanel({
  data,
  loading,
  error,
}: {
  data: ActivitySummaryResponse | null;
  loading: boolean;
  error: boolean;
}) {
  const t = useTranslations('fmf.dashboard.analytics');
  const format = useFormatter();

  const { types, max } = useMemo(() => {
    const entries = Object.entries(data?.byType ?? {}).sort((a, b) => b[1] - a[1]);
    return { types: entries, max: Math.max(1, ...entries.map(([, n]) => n)) };
  }, [data]);

  return (
    <Card className="enter gap-0 py-0" style={{ animationDelay: '200ms' }}>
      <div className="flex items-center justify-between border-b border-line px-5 py-4">
        <h2 className="font-mono text-[13px] font-semibold uppercase tracking-[0.12em] text-ink">
          {t('title')}
        </h2>
        <Badge variant="accent">service-2</Badge>
      </div>

      <div className="px-5 py-5">
        {error && <FormAlert kind="error">{t('loadError')}</FormAlert>}

        {!error && (
          <>
            {/* hero number */}
            <div className="mb-5">
              <span className="font-mono text-[11px] uppercase tracking-[0.14em] text-ink-faint">
                {t('total')}
              </span>
              <div className="mt-1 flex items-baseline gap-2">
                {loading && !data ? (
                  <Skeleton className="h-9 w-24" />
                ) : (
                  <span className="font-mono text-4xl font-semibold tabular text-phosphor-glow">
                    {format.number(data?.total ?? 0)}
                  </span>
                )}
              </div>
            </div>

            <p className="mb-3 font-mono text-[11px] uppercase tracking-[0.14em] text-ink-faint">
              {t('byType')}
            </p>

            {loading && !data ? (
              <div className="space-y-2">
                {Array.from({ length: 2 }).map((_, i) => (
                  <Skeleton key={i} className="h-10" />
                ))}
              </div>
            ) : types.length === 0 ? (
              <p className="font-mono text-sm text-ink-dim">{t('none')}</p>
            ) : (
              <ul className="space-y-2">
                {types.map(([eventType, count]) => (
                  <li
                    key={eventType}
                    className="rounded-md border border-line bg-base-2/40 px-3.5 py-2.5"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <span className="truncate font-mono text-[13px] text-ink">{eventType}</span>
                      <span className="shrink-0 font-mono text-[11px] tabular text-primary">
                        {format.number(count)}
                      </span>
                    </div>
                    <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-white/[0.04]">
                      <span
                        className="bar-grow bar-heat block h-full"
                        style={{
                          width: `${(count / max) * 100}%`,
                          boxShadow: '0 0 8px rgba(255,90,31,0.45)',
                        }}
                      />
                    </div>
                  </li>
                ))}
              </ul>
            )}

            <div className="mt-4 flex items-center justify-between font-mono text-[10px] uppercase tracking-[0.1em] text-ink-faint">
              <span>{t('source')}</span>
              <span>
                {t('lastActivity')}:{' '}
                {data?.lastActivityAt
                  ? format.dateTime(new Date(data.lastActivityAt), {
                      month: 'short',
                      day: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                    })
                  : t('never')}
              </span>
            </div>
          </>
        )}
      </div>
    </Card>
  );
}
