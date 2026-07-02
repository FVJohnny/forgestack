'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { Button } from '@/app/shared/ui/button';
import { Input } from '@/app/shared/ui/input';
import { Label } from '@/app/shared/ui/label';
import { FormAlert } from '@/app/shared/ui/form-alert';
import { AuthShell } from '@/app/shared/auth/auth-shell';
import { AuthHeading } from '@/app/shared/auth/auth-heading';
import { authService } from '@/lib/api/services/auth.service';

export default function ForgotPasswordPage() {
  const t = useTranslations('auth.forgotPassword');
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);
    try {
      await authService.requestPasswordReset(email);
      setSuccess(true);
    } catch (err) {
      console.error('Forgot password error:', err);
      setError(err instanceof Error ? err.message : t('error'));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <AuthShell>
      <AuthHeading title={t('title')} subtitle={t('description')} />

      {success ? (
        <div className="space-y-6">
          <FormAlert kind="success">{t('success', { email })}</FormAlert>
          <Button asChild className="w-full" size="lg">
            <Link href="/login">{t('backToSignIn')}</Link>
          </Button>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-5">
          {error && <FormAlert kind="error">{error}</FormAlert>}
          <div className="space-y-2">
            <Label htmlFor="email">{t('email')}</Label>
            <Input
              id="email"
              type="email"
              autoComplete="email"
              placeholder={t('emailPlaceholder')}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>
          <Button type="submit" disabled={isLoading} className="w-full" size="lg">
            {isLoading ? t('submitting') : t('submit')}
          </Button>
          <p className="text-center">
            <Link
              href="/login"
              className="font-mono text-[13px] text-ink-dim transition-colors hover:text-primary"
            >
              {t('backToSignIn')}
            </Link>
          </p>
        </form>
      )}
    </AuthShell>
  );
}
