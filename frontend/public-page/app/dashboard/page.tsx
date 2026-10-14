'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useFormatter, useTranslations } from 'next-intl';
import {
  ArrowUpRight,
  Globe,
  ListTodo,
  MonitorSmartphone,
  ShieldHalf,
  UserCog,
} from 'lucide-react';
import { Card } from '@/app/shared/ui/card';
import { Skeleton } from '@/app/shared/ui/skeleton';
import { motdService } from '@/lib/api/services/motd.service';
import { accountService } from '@/lib/api/services/account.service';
import type { GetMotdResponse, SigninActivityResponse } from '@/lib/api/types';
import { useUser } from '@/lib/contexts/user-context';
import { PageHeader } from './components/page-header';
import { MotdBanner } from './components/motd-banner';
import { AccountMiniCard } from './components/account-mini-card';

export default function DashboardHomePage() {
  const t = useTranslations('app.dashboard');
  const { user } = useUser();

  const [motd, setMotd] = useState<GetMotdResponse | null>(null);
  const [activity, setActivity] = useState<SigninActivityResponse | null>(null);
  const [activityError, setActivityError] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    (async () => {
      await Promise.all([
        motdService
          .getMotd()
          .then((m) => mounted && setMotd(m))
          .catch(() => {}),
        accountService
          .getSigninActivity()
          .then((a) => mounted && setActivity(a))
          .catch(() => mounted && setActivityError(true)),
      ]);
      if (mounted) setLoading(false);
    })();
    return () => {
      mounted = false;
    };
  }, []);

  const isAdmin = user?.role === 'admin';

  return (
    <div>
      <PageHeader
        title={t('title')}
        subtitle={user?.email ? t('welcome', { email: user.email }) : t('subtitle')}
      />

      <MotdBanner motd={motd} />

      <div className="mb-5 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
        <QuickLink
          href="/dashboard/tasks"
          Icon={ListTodo}
          title={t('quickLinks.tasks.title')}
          description={t('quickLinks.tasks.description')}
        />
        <QuickLink
          href="/dashboard/account"
          Icon={UserCog}
          title={t('quickLinks.account.title')}
          description={t('quickLinks.account.description')}
        />
        {isAdmin && (
          <QuickLink
            href="/dashboard/admin"
            Icon={ShieldHalf}
            title={t('quickLinks.admin.title')}
            description={t('quickLinks.admin.description')}
          />
        )}
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <SigninActivityCard data={activity} loading={loading} error={activityError} />
        </div>
        <div>
          <AccountMiniCard />
        </div>
      </div>
    </div>
  );
}

function QuickLink({
  href,
  Icon,
  title,
  description,
}: {
  href: string;
  Icon: typeof ListTodo;
  title: string;
  description: string;
}) {
  return (
    <Link href={href} className="group">
      <Card className="enter h-full gap-2 px-5 py-4 transition-colors group-hover:border-primary/40">
        <div className="flex items-center justify-between">
          <Icon className="size-5 text-primary" />
          <ArrowUpRight className="size-4 text-ink-faint transition-colors group-hover:text-primary" />
        </div>
        <h2 className="font-mono text-[13px] font-semibold uppercase tracking-[0.12em] text-ink">
          {title}
        </h2>
        <p className="text-[13px] leading-relaxed text-ink-dim">{description}</p>
      </Card>
    </Link>
  );
}

function SigninActivityCard({
  data,
  loading,
  error,
}: {
  data: SigninActivityResponse | null;
  loading: boolean;
  error: boolean;
}) {
  const t = useTranslations('app.dashboard.activity');
  const format = useFormatter();

  const formatWhen = (iso: string) =>
    format.dateTime(new Date(iso), {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });

  return (
    <Card className="enter gap-0 py-0" style={{ animationDelay: '60ms' }}>
      <div className="border-b border-line px-5 py-4">
        <h2 className="font-mono text-[13px] font-semibold uppercase tracking-[0.12em] text-ink">
          {t('title')}
        </h2>
      </div>

      {loading ? (
        <div className="space-y-3 px-5 py-4">
          <Skeleton className="h-4 w-56" />
          <Skeleton className="h-4 w-40" />
          <Skeleton className="h-4 w-48" />
        </div>
      ) : error || !data ? (
        <p className="px-5 py-4 text-[13px] text-ink-dim">{t('loadError')}</p>
      ) : (
        <div className="divide-y divide-line">
          <div className="flex items-center justify-between gap-4 px-5 py-3.5">
            <span className="font-mono text-[11px] uppercase tracking-[0.12em] text-ink-faint">
              {t('lastLogin')}
            </span>
            <span className="font-mono text-[13px] text-ink">
              {data.lastLogin ? formatWhen(data.lastLogin) : t('never')}
            </span>
          </div>

          <ActivitySection
            Icon={Globe}
            label={t('ips')}
            entries={data.ips}
            empty={t('empty')}
            formatWhen={formatWhen}
            lastSeenLabel={t('lastSeen')}
          />
          <ActivitySection
            Icon={MonitorSmartphone}
            label={t('devices')}
            entries={data.userAgents}
            empty={t('empty')}
            formatWhen={formatWhen}
            lastSeenLabel={t('lastSeen')}
          />
        </div>
      )}
    </Card>
  );
}

function ActivitySection({
  Icon,
  label,
  entries,
  empty,
  formatWhen,
  lastSeenLabel,
}: {
  Icon: typeof Globe;
  label: string;
  entries: SigninActivityResponse['ips'];
  empty: string;
  formatWhen: (iso: string) => string;
  lastSeenLabel: string;
}) {
  return (
    <div className="px-5 py-3.5">
      <div className="mb-2 flex items-center gap-2">
        <Icon className="size-3.5 text-ink-faint" />
        <span className="font-mono text-[11px] uppercase tracking-[0.12em] text-ink-faint">
          {label}
        </span>
      </div>
      {entries.length === 0 ? (
        <p className="text-[13px] text-ink-dim">{empty}</p>
      ) : (
        <ul className="space-y-1.5">
          {entries.map((entry) => (
            <li key={entry.value} className="flex items-baseline justify-between gap-4">
              <span className="truncate font-mono text-[13px] text-ink">{entry.value}</span>
              <span className="shrink-0 font-mono text-[11px] text-ink-faint">
                {lastSeenLabel} {formatWhen(entry.lastSeen)} · {entry.seenCount}x
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
