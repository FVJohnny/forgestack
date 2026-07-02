'use client';

import { useCallback, useEffect, useState } from 'react';
import { useFormatter, useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { Ban, CircleCheck, Trash2, UserRoundCog, Search } from 'lucide-react';
import { Card } from '@/app/shared/ui/card';
import { Badge } from '@/app/shared/ui/badge';
import { Button } from '@/app/shared/ui/button';
import { Input } from '@/app/shared/ui/input';
import { Skeleton } from '@/app/shared/ui/skeleton';
import { FormAlert } from '@/app/shared/ui/form-alert';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/app/shared/ui/table';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/app/shared/ui/dialog';
import { adminService } from '@/lib/api/services/admin.service';
import { authService } from '@/lib/contexts/auth-service';
import type { UserFilterField } from '@/lib/api/config';
import type { ListUsersResponse, SearchUserResult } from '@/lib/api/types';

const PAGE_SIZE = 10;

function statusVariant(status: string): 'live' | 'warn' | 'down' | 'default' {
  const s = status?.toLowerCase?.() ?? '';
  if (s.includes('active')) return 'live';
  if (s.includes('suspend')) return 'warn';
  if (s.includes('delet')) return 'down';
  return 'default';
}

export function UsersTable() {
  const t = useTranslations('fmf.admin.users');
  const format = useFormatter();

  const [data, setData] = useState<ListUsersResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [page, setPage] = useState(1);
  const [filterField, setFilterField] = useState<UserFilterField>('email');
  const [filterValue, setFilterValue] = useState('');
  const [appliedFilter, setAppliedFilter] = useState('');
  const [busyId, setBusyId] = useState<string | null>(null);
  const [pendingDelete, setPendingDelete] = useState<SearchUserResult | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(false);
    try {
      const res = await adminService.listUsers({
        page,
        limit: PAGE_SIZE,
        filterField: appliedFilter ? filterField : undefined,
        filterValue: appliedFilter || undefined,
      });
      setData(res);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, [page, filterField, appliedFilter]);

  useEffect(() => {
    void load();
  }, [load]);

  const applyFilter = () => {
    setPage(1);
    setAppliedFilter(filterValue.trim());
  };

  const clearFilter = () => {
    setFilterValue('');
    setAppliedFilter('');
    setPage(1);
  };

  const runAction = async (id: string, fn: () => Promise<void>, successMsg: string) => {
    setBusyId(id);
    try {
      await fn();
      toast.success(successMsg);
      await load();
    } catch {
      toast.error(t('toast.actionFailed'));
    } finally {
      setBusyId(null);
    }
  };

  const impersonate = async (id: string) => {
    setBusyId(id);
    try {
      await authService.impersonate(id);
      window.location.href = '/dashboard';
    } catch {
      toast.error(t('toast.actionFailed'));
      setBusyId(null);
    }
  };

  const confirmDelete = async () => {
    if (!pendingDelete) return;
    const id = pendingDelete.id;
    setPendingDelete(null);
    await runAction(id, () => adminService.deleteUser(id), t('toast.deleted'));
  };

  const users = data?.users ?? [];
  const totalPages = data?.totalPages ?? 1;

  return (
    <Card className="gap-0 py-0">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-5 py-4">
        <h2 className="font-mono text-[13px] font-semibold uppercase tracking-[0.12em] text-ink">
          {t('title')}
        </h2>
        <div className="flex flex-wrap items-center gap-2">
          {/* segmented filter field */}
          <div className="flex overflow-hidden rounded-md border border-line-strong">
            {(['email', 'ip'] as UserFilterField[]).map((f) => (
              <button
                key={f}
                onClick={() => setFilterField(f)}
                className={`px-2.5 py-1.5 font-mono text-[11px] uppercase tracking-[0.1em] transition-colors ${
                  filterField === f ? 'bg-primary/15 text-primary' : 'text-ink-faint hover:text-ink'
                }`}
              >
                {f === 'email' ? t('filterEmail') : t('filterIp')}
              </button>
            ))}
          </div>
          <div className="relative">
            <Input
              value={filterValue}
              onChange={(e) => setFilterValue(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && applyFilter()}
              placeholder={t('filterPlaceholder', {
                field: filterField === 'email' ? t('filterEmail') : t('filterIp'),
              })}
              className="h-9 w-44 pl-8"
            />
            <Search className="absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-ink-faint" />
          </div>
          <Button size="sm" variant="outline" onClick={applyFilter}>
            {t('search')}
          </Button>
          {appliedFilter && (
            <Button size="sm" variant="ghost" onClick={clearFilter}>
              {t('clear')}
            </Button>
          )}
        </div>
      </div>

      <div className="px-1.5 py-1.5 sm:px-3 sm:py-3">
        {error ? (
          <div className="px-3 py-4">
            <FormAlert kind="error">{t('loadError')}</FormAlert>
          </div>
        ) : loading && !data ? (
          <div className="space-y-2 px-2 py-2">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-11" />
            ))}
          </div>
        ) : users.length === 0 ? (
          <p className="px-3 py-8 text-center font-mono text-sm text-ink-dim">{t('empty')}</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead>{t('columns.email')}</TableHead>
                <TableHead>{t('columns.role')}</TableHead>
                <TableHead>{t('columns.status')}</TableHead>
                <TableHead>{t('columns.created')}</TableHead>
                <TableHead>{t('columns.ips')}</TableHead>
                <TableHead className="text-right">{t('columns.actions')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {users.map((u) => {
                const suspended = u.status?.toLowerCase?.().includes('suspend');
                const deleted = u.status?.toLowerCase?.().includes('delet');
                const busy = busyId === u.id;
                return (
                  <TableRow key={u.id}>
                    <TableCell className="font-mono text-[13px]">{u.email}</TableCell>
                    <TableCell>
                      <Badge variant={u.role === 'admin' ? 'accent' : 'outline'}>{u.role}</Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant={statusVariant(u.status)}>{u.status}</Badge>
                    </TableCell>
                    <TableCell className="font-mono text-[12px] text-ink-dim tabular">
                      {format.dateTime(new Date(u.createdAt), {
                        year: 'numeric',
                        month: 'short',
                        day: 'numeric',
                      })}
                    </TableCell>
                    <TableCell className="font-mono text-[12px] text-ink-dim tabular">
                      {u.ips?.length ? u.ips.length : '—'}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          size="icon-sm"
                          variant="ghost"
                          title={t('impersonate')}
                          disabled={busy || deleted}
                          onClick={() => impersonate(u.id)}
                        >
                          <UserRoundCog className="size-4" />
                        </Button>
                        {suspended ? (
                          <Button
                            size="icon-sm"
                            variant="ghost"
                            title={t('unsuspend')}
                            disabled={busy || deleted}
                            onClick={() =>
                              runAction(
                                u.id,
                                () => adminService.unsuspendUser(u.id),
                                t('toast.unsuspended'),
                              )
                            }
                          >
                            <CircleCheck className="size-4 text-primary" />
                          </Button>
                        ) : (
                          <Button
                            size="icon-sm"
                            variant="ghost"
                            title={t('suspend')}
                            disabled={busy || deleted}
                            onClick={() =>
                              runAction(
                                u.id,
                                () => adminService.suspendUser(u.id),
                                t('toast.suspended'),
                              )
                            }
                          >
                            <Ban className="size-4 text-[var(--amber)]" />
                          </Button>
                        )}
                        <Button
                          size="icon-sm"
                          variant="ghost"
                          title={t('delete')}
                          disabled={busy || deleted}
                          onClick={() => setPendingDelete(u)}
                        >
                          <Trash2 className="size-4 text-[var(--red)]" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </div>

      {data && users.length > 0 && (
        <div className="flex items-center justify-between border-t border-line px-5 py-3">
          <span className="font-mono text-[11px] text-ink-faint tabular">
            {t('page', { current: data.page, total: totalPages })} ·{' '}
            {t('total', { count: data.total })}
          </span>
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              disabled={page <= 1 || loading}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
            >
              {t('prev')}
            </Button>
            <Button
              size="sm"
              variant="outline"
              disabled={page >= totalPages || loading}
              onClick={() => setPage((p) => p + 1)}
            >
              {t('next')}
            </Button>
          </div>
        </div>
      )}

      <Dialog open={!!pendingDelete} onOpenChange={(o) => !o && setPendingDelete(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{t('confirmDelete.title')}</DialogTitle>
            <DialogDescription>
              {t('confirmDelete.body', { email: pendingDelete?.email ?? '' })}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setPendingDelete(null)}>
              {t('clear')}
            </Button>
            <Button variant="destructive" onClick={confirmDelete}>
              {t('confirmDelete.confirm')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
