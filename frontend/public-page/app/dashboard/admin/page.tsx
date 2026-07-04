'use client';

import { useTranslations } from 'next-intl';
import { ShieldAlert } from 'lucide-react';
import { Card } from '@/app/shared/ui/card';
import { Skeleton } from '@/app/shared/ui/skeleton';
import { useUser } from '@/lib/contexts/user-context';
import { PageHeader } from '../components/page-header';
import { UsersTable } from './components/users-table';
import { MotdEditor } from './components/motd-editor';

export default function AdminPage() {
  const t = useTranslations('fmf.admin');
  const { user, isLoading } = useUser();

  if (isLoading) {
    return (
      <div>
        <PageHeader title={t('title')} subtitle={t('subtitle')} />
        <Skeleton className="h-80" />
      </div>
    );
  }

  if (user?.role !== 'admin') {
    return (
      <div>
        <PageHeader title={t('title')} />
        <Card className="items-center justify-center gap-3 py-16 text-center">
          <span className="grid size-12 place-items-center rounded-full border border-[var(--amber)]/30 bg-[var(--amber)]/10 text-[var(--amber)]">
            <ShieldAlert className="size-6" />
          </span>
          <h2 className="text-lg font-semibold text-ink">{t('onlyTitle')}</h2>
          <p className="max-w-sm text-sm text-ink-dim">{t('onlyDesc')}</p>
        </Card>
      </div>
    );
  }

  return (
    <div>
      <PageHeader title={t('title')} subtitle={t('subtitle')} />
      <div className="space-y-5">
        <UsersTable />
        <MotdEditor />
      </div>
    </div>
  );
}
