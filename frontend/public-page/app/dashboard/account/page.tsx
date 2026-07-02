'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { Card } from '@/app/shared/ui/card';
import { Badge } from '@/app/shared/ui/badge';
import { Button } from '@/app/shared/ui/button';
import { Label } from '@/app/shared/ui/label';
import { PasswordInput } from '@/app/shared/ui/password-input';
import { FormAlert } from '@/app/shared/ui/form-alert';
import { Skeleton } from '@/app/shared/ui/skeleton';
import { useUser } from '@/lib/contexts/user-context';
import { useAuth } from '@/lib/contexts/auth-context';
import { accountService } from '@/lib/api/services/account.service';
import { PageHeader } from '../components/page-header';

export default function AccountPage() {
  const t = useTranslations('fmf.account');
  const { user, isLoading } = useUser();
  const { logout } = useAuth();

  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (newPassword !== confirmPassword) {
      setError(t('password.errors.mismatch'));
      return;
    }
    if (newPassword.length < 8) {
      setError(t('password.errors.tooShort'));
      return;
    }
    setSubmitting(true);
    try {
      await accountService.changePassword(oldPassword, newPassword);
      setDone(true);
      toast.success(t('password.success'));
      setTimeout(() => logout(), 2500);
    } catch (err) {
      setError(err instanceof Error ? err.message : t('password.errors.failed'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div>
      <PageHeader title={t('title')} subtitle={t('subtitle')} />

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        {/* profile */}
        <Card className="gap-0 py-0">
          <div className="border-b border-line px-5 py-4">
            <h2 className="font-mono text-[13px] font-semibold uppercase tracking-[0.12em] text-ink">
              {t('profile.title')}
            </h2>
          </div>
          <dl className="divide-y divide-line px-5">
            <Row label={t('profile.email')}>
              {isLoading ? <Skeleton className="h-4 w-44" /> : (user?.email ?? '—')}
            </Row>
            <Row label={t('profile.role')}>
              {isLoading ? (
                <Skeleton className="h-4 w-16" />
              ) : (
                <Badge variant={user?.role === 'admin' ? 'accent' : 'outline'}>
                  {user?.role ?? 'user'}
                </Badge>
              )}
            </Row>
            <Row label={t('profile.userId')}>
              {isLoading ? (
                <Skeleton className="h-4 w-28" />
              ) : (
                <span className="truncate text-ink-dim">{user?.userId ?? '—'}</span>
              )}
            </Row>
          </dl>
          <div className="h-5" />
        </Card>

        {/* change password */}
        <Card className="gap-0 py-0">
          <div className="border-b border-line px-5 py-4">
            <h2 className="font-mono text-[13px] font-semibold uppercase tracking-[0.12em] text-ink">
              {t('password.title')}
            </h2>
          </div>
          <form onSubmit={handleSubmit} className="space-y-5 px-5 py-5">
            {error && <FormAlert kind="error">{error}</FormAlert>}
            {done && <FormAlert kind="success">{t('password.success')}</FormAlert>}

            <div className="space-y-2">
              <Label htmlFor="old">{t('password.current')}</Label>
              <PasswordInput
                id="old"
                autoComplete="current-password"
                placeholder={t('password.currentPlaceholder')}
                value={oldPassword}
                onChange={(e) => setOldPassword(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="new">{t('password.new')}</Label>
              <PasswordInput
                id="new"
                autoComplete="new-password"
                placeholder={t('password.newPlaceholder')}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                required
                minLength={8}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirm">{t('password.confirm')}</Label>
              <PasswordInput
                id="confirm"
                autoComplete="new-password"
                placeholder={t('password.confirmPlaceholder')}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                minLength={8}
              />
            </div>
            <Button type="submit" disabled={submitting || done} className="w-full">
              {submitting ? t('password.submitting') : t('password.submit')}
            </Button>
          </form>
        </Card>
      </div>
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4 py-3.5">
      <dt className="font-mono text-[11px] uppercase tracking-[0.12em] text-ink-faint">{label}</dt>
      <dd className="min-w-0 truncate font-mono text-[13px] text-ink">{children}</dd>
    </div>
  );
}
