'use client';

import { useTranslations } from 'next-intl';
import { Card } from '@/app/shared/ui/card';
import { Badge } from '@/app/shared/ui/badge';
import { StatusDot, type StatusKind } from '@/app/shared/ui/status-dot';
import { Skeleton } from '@/app/shared/ui/skeleton';
import { FormAlert } from '@/app/shared/ui/form-alert';
import type { DashboardHealthResponse } from '@/lib/api/types';

function checkStatus(raw: string): StatusKind {
  const v = raw?.toLowerCase?.() ?? '';
  if (['up', 'ok', 'healthy', 'ready', 'connected'].includes(v)) return 'live';
  if (['degraded', 'warning', 'warn'].includes(v)) return 'warn';
  if (['down', 'error', 'unhealthy', 'fail', 'failed', 'disconnected'].includes(v)) return 'down';
  return 'idle';
}

export function HealthPanel({
  data,
  loading,
  error,
}: {
  data: DashboardHealthResponse | null;
  loading: boolean;
  error: boolean;
}) {
  const t = useTranslations('fmf.dashboard.health');
  const checks = data ? Object.entries(data.checks ?? {}) : [];

  return (
    <Card className="enter gap-0 py-0" style={{ animationDelay: '60ms' }}>
      <div className="flex items-center justify-between border-b border-line px-5 py-4">
        <h2 className="font-mono text-[13px] font-semibold uppercase tracking-[0.12em] text-ink">
          {t('title')}
        </h2>
        {data && (
          <Badge variant={data.ready ? 'live' : 'down'}>
            <StatusDot status={data.ready ? 'live' : 'down'} />
            {data.ready ? t('ready') : t('notReady')}
          </Badge>
        )}
      </div>

      <div className="px-5 py-4">
        {error && <FormAlert kind="error">{t('loadError')}</FormAlert>}

        {!error && loading && !data && (
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-12" />
            ))}
          </div>
        )}

        {!error && data && (
          <>
            <div className="mb-4 flex flex-wrap gap-2">
              <Badge variant="outline">
                {t('service')}: {data.service}
              </Badge>
              <Badge variant="outline">
                {t('environment')}: {data.environment}
              </Badge>
            </div>

            {checks.length === 0 ? (
              <p className="font-mono text-sm text-ink-dim">{t('noChecks')}</p>
            ) : (
              <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                {checks.map(([name, check]) => {
                  const status = checkStatus(String(check?.status ?? ''));
                  return (
                    <li
                      key={name}
                      className="flex items-center justify-between gap-3 rounded-md border border-line bg-base-2/50 px-3.5 py-2.5"
                    >
                      <span className="flex items-center gap-2.5">
                        <StatusDot status={status} />
                        <span className="font-mono text-[13px] text-ink">{name}</span>
                      </span>
                      <span className="font-mono text-[11px] uppercase tracking-[0.1em] text-ink-faint">
                        {String(check?.status ?? '—')}
                      </span>
                    </li>
                  );
                })}
              </ul>
            )}
          </>
        )}
      </div>
    </Card>
  );
}
