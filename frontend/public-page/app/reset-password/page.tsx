'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { Button } from '@/app/shared/ui/button';
import { Label } from '@/app/shared/ui/label';
import { PasswordInput } from '@/app/shared/ui/password-input';
import { FormAlert } from '@/app/shared/ui/form-alert';
import { AuthShell } from '@/app/shared/auth/auth-shell';
import { AuthHeading } from '@/app/shared/auth/auth-heading';
import { authService } from '@/lib/api/services/auth.service';

function ResetPasswordForm() {
  const t = useTranslations('auth.resetPassword');
  const tLogin = useTranslations('auth.login');
  const router = useRouter();
  const searchParams = useSearchParams();
  const passwordResetId = searchParams.get('id');

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    if (!passwordResetId) setError(t('errors.invalid'));
  }, [passwordResetId, t]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (password !== confirmPassword) {
      setError(t('errors.mismatch'));
      return;
    }
    if (!passwordResetId) {
      setError(t('errors.invalid'));
      return;
    }
    setIsLoading(true);
    try {
      await authService.executePasswordReset(passwordResetId, password);
      setSuccess(true);
      setTimeout(() => router.push('/login'), 3000);
    } catch (err) {
      console.error('Reset password error:', err);
      setError(err instanceof Error ? err.message : t('errors.failed'));
    } finally {
      setIsLoading(false);
    }
  };

  if (success) {
    return (
      <div className="space-y-6">
        <FormAlert kind="success">{t('success')}</FormAlert>
        <Button asChild className="w-full" size="lg">
          <Link href="/login">{tLogin('submit')}</Link>
        </Button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {error && <FormAlert kind="error">{error}</FormAlert>}
      <div className="space-y-2">
        <Label htmlFor="password">{t('password')}</Label>
        <PasswordInput
          id="password"
          autoComplete="new-password"
          placeholder={t('passwordPlaceholder')}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="confirmPassword">{t('confirmPassword')}</Label>
        <PasswordInput
          id="confirmPassword"
          autoComplete="new-password"
          placeholder={t('confirmPasswordPlaceholder')}
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          required
        />
      </div>
      <Button type="submit" disabled={isLoading || !passwordResetId} className="w-full" size="lg">
        {isLoading ? t('submitting') : t('submit')}
      </Button>
    </form>
  );
}

export default function ResetPasswordPage() {
  const t = useTranslations('auth.resetPassword');
  return (
    <AuthShell>
      <AuthHeading title={t('title')} subtitle={t('description')} />
      <Suspense
        fallback={
          <div className="flex justify-center py-8">
            <div className="size-7 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          </div>
        }
      >
        <ResetPasswordForm />
      </Suspense>
    </AuthShell>
  );
}
