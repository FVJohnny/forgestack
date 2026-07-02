'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useFormatter, useTranslations } from 'next-intl';
import { Badge } from '@/app/shared/ui/badge';
import { StatusDot } from '@/app/shared/ui/status-dot';
import { usePolling } from '@/lib/hooks/use-polling';
import { dashboardService } from '@/lib/api/services/dashboard.service';
import { analyticsService } from '@/lib/api/services/analytics.service';
import type {
  ActivitySummaryResponse,
  DashboardEventsResponse,
  DashboardHealthResponse,
  GetMotdResponse,
} from '@/lib/api/types';
import { PageHeader } from './components/page-header';
import { HealthPanel } from './components/health-panel';
import { EventsPanel } from './components/events-panel';
import { AnalyticsPanel } from './components/analytics-panel';
import { MotdBanner } from './components/motd-banner';
import { AccountMiniCard } from './components/account-mini-card';

const EVENTS_POLL_MS = 5000;
const HEALTH_POLL_MS = 15000;

export default function DashboardOverviewPage() {
  const t = useTranslations('fmf.dashboard');
  const format = useFormatter();

  const [health, setHealth] = useState<DashboardHealthResponse | null>(null);
  const [events, setEvents] = useState<DashboardEventsResponse | null>(null);
  const [activity, setActivity] = useState<ActivitySummaryResponse | null>(null);
  const [motd, setMotd] = useState<GetMotdResponse | null>(null);

  const [healthError, setHealthError] = useState(false);
  const [eventsError, setEventsError] = useState(false);
  const [activityError, setActivityError] = useState(false);
  const [loading, setLoading] = useState(true);
  const [syncedAt, setSyncedAt] = useState<Date | null>(null);

  const healthTick = useRef(0);

  const loadEvents = useCallback(async () => {
    try {
      const data = await dashboardService.getEvents();
      setEvents(data);
      setEventsError(false);
      setSyncedAt(new Date());
    } catch {
      setEventsError(true);
    }
  }, []);

  const loadHealth = useCallback(async () => {
    try {
      const data = await dashboardService.getHealth();
      setHealth(data);
      setHealthError(false);
    } catch {
      setHealthError(true);
    }
  }, []);

  const loadActivity = useCallback(async () => {
    try {
      const data = await analyticsService.getSummary();
      setActivity(data);
      setActivityError(false);
    } catch {
      setActivityError(true);
    }
  }, []);

  // initial load
  useEffect(() => {
    let mounted = true;
    (async () => {
      await Promise.all([
        loadEvents(),
        loadHealth(),
        loadActivity(),
        dashboardService
          .getMotd()
          .then((m) => mounted && setMotd(m))
          .catch(() => {}),
      ]);
      if (mounted) setLoading(false);
    })();
    return () => {
      mounted = false;
    };
  }, [loadEvents, loadHealth, loadActivity]);

  // poll events + activity fast; poll health on every 3rd tick (~15s)
  usePolling(
    async () => {
      await Promise.all([loadEvents(), loadActivity()]);
      healthTick.current += 1;
      if (healthTick.current % Math.round(HEALTH_POLL_MS / EVENTS_POLL_MS) === 0) {
        await loadHealth();
      }
    },
    EVENTS_POLL_MS,
    true,
  );

  return (
    <div>
      <PageHeader
        title={t('title')}
        subtitle={t('subtitle')}
        actions={
          <div className="flex items-center gap-3">
            <Badge variant="live">
              <StatusDot status="live" />
              {t('live')}
            </Badge>
            {syncedAt && (
              <span className="hidden font-mono text-[11px] text-ink-faint sm:inline">
                {t('refreshedAt', {
                  time: format.dateTime(syncedAt, {
                    hour: '2-digit',
                    minute: '2-digit',
                    second: '2-digit',
                  }),
                })}
              </span>
            )}
          </div>
        }
      />

      <MotdBanner motd={motd} />

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        <div className="space-y-5 lg:col-span-2">
          <HealthPanel data={health} loading={loading} error={healthError} />
          <EventsPanel data={events} loading={loading} error={eventsError} />
        </div>
        <div className="space-y-5">
          <AccountMiniCard />
          <AnalyticsPanel data={activity} loading={loading} error={activityError} />
        </div>
      </div>
    </div>
  );
}
