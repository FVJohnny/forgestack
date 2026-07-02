'use client';

import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { ArrowUpRight } from 'lucide-react';
import { Card } from '@/app/shared/ui/card';
import { Badge } from '@/app/shared/ui/badge';
import { Skeleton } from '@/app/shared/ui/skeleton';
import { useUser } from '@/lib/contexts/user-context';

export function AccountMiniCard() {
  const t = useTranslations('fmf.dashboard.account');
  const { user, isLoading } = useUser();

  return (
    <Card className="enter gap-0 py-0" style={{ animationDelay: '100ms' }}>
      <div className="flex items-center justify-between border-b border-line px-5 py-4">
        <h2 className="font-mono text-[13px] font-semibold uppercase tracking-[0.12em] text-ink">
          {t('title')}
        </h2>
        <Link
          href="/dashboard/account"
          className="flex items-center gap-1 font-mono text-[11px] text-ink-dim transition-colors hover:text-primary"
        >
          {t('view')}
          <ArrowUpRight className="size-3.5" />
        </Link>
      </div>

      <dl className="divide-y divide-line px-5">
        <Row label={t('email')}>
          {isLoading ? <Skeleton className="h-4 w-40" /> : (user?.email ?? '—')}
        </Row>
        <Row label={t('role')}>
          {isLoading ? (
            <Skeleton className="h-4 w-16" />
          ) : (
            <Badge variant={user?.role === 'admin' ? 'accent' : 'outline'}>
              {user?.role ?? 'user'}
            </Badge>
          )}
        </Row>
      </dl>
      <div className="h-5" />
    </Card>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4 py-3.5">
      <dt className="font-mono text-[11px] uppercase tracking-[0.12em] text-ink-faint">{label}</dt>
      <dd className="truncate font-mono text-[13px] text-ink">{children}</dd>
    </div>
  );
}
