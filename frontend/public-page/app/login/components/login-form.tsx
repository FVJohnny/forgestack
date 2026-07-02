'use client';

import type React from 'react';
import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { Button } from '@/app/shared/ui/button';
import { Input } from '@/app/shared/ui/input';
import { Label } from '@/app/shared/ui/label';
import { PasswordInput } from '@/app/shared/ui/password-input';
import { FormAlert } from '@/app/shared/ui/form-alert';
import { AuthHeading } from '@/app/shared/auth/auth-heading';
import { GoogleSignInButton } from '@/app/shared/ui/google-sign-in-button';
import { useAuth } from '@/lib/contexts/auth-context';

const GOOGLE_OAUTH_ENABLED = !!process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;

export function LoginForm() {
  const t = useTranslations('auth.login');
  const router = useRouter();
  const searchParams = useSearchParams();
  const { login, loginWithGoogle } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);

  const handleGoogleSuccess = async (accessToken: string) => {
    setError('');
    setIsGoogleLoading(true);
    try {
      await loginWithGoogle(accessToken);
      router.push('/dashboard');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : t('googleError'));
    } finally {
      setIsGoogleLoading(false);
    }
  };

  useEffect(() => {
    if (searchParams.get('registered') === 'true') {
      const emailParam = searchParams.get('email');
      setSuccessMessage(
        t('successMessage', { email: emailParam ? decodeURIComponent(emailParam) : '' }),
      );
    }
  }, [searchParams, t]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);
    try {
      await login(email, password);
      router.push('/dashboard');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : t('errorDefault'));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div>
      <AuthHeading title={t('title')} subtitle={t('subtitle')} />

      {successMessage && (
        <FormAlert kind="success" className="mb-4">
          {successMessage}
        </FormAlert>
      )}
      {error && (
        <FormAlert kind="error" className="mb-4">
          {error}
        </FormAlert>
      )}

      <form onSubmit={handleSubmit} className="space-y-5">
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

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label htmlFor="password">{t('password')}</Label>
            <Link
              href="/forgot-password"
              className="font-mono text-[11px] text-ink-dim transition-colors hover:text-primary"
            >
              {t('forgotPassword')}
            </Link>
          </div>
          <PasswordInput
            id="password"
            autoComplete="current-password"
            placeholder={t('passwordPlaceholder')}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </div>

        <Button type="submit" disabled={isLoading || isGoogleLoading} className="w-full" size="lg">
          {isLoading ? t('submitting') : t('submit')}
        </Button>
      </form>

      {GOOGLE_OAUTH_ENABLED && (
        <>
          <div className="relative my-6">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t border-line" />
            </div>
            <div className="relative flex justify-center">
              <span className="bg-background px-3 font-mono text-[11px] uppercase tracking-[0.14em] text-ink-faint">
                {t('orContinueWith')}
              </span>
            </div>
          </div>
          <GoogleSignInButton
            onSuccess={handleGoogleSuccess}
            onError={() => setError(t('googleError'))}
            isLoading={isGoogleLoading}
            disabled={isLoading || isGoogleLoading}
          />
        </>
      )}

      <p className="mt-7 text-center font-mono text-[13px] text-ink-dim">
        {t('noAccount')}{' '}
        <Link href="/register" className="text-primary hover:underline">
          {t('createAccount')}
        </Link>
      </p>
    </div>
  );
}
