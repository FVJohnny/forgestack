'use client';

import type React from 'react';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
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

export function RegisterForm() {
  const t = useTranslations('auth.register');
  const tLogin = useTranslations('auth.login');
  const router = useRouter();
  const { register, login, loginWithGoogle } = useAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);

  const handleGoogleSuccess = async (accessToken: string) => {
    setError('');
    setIsGoogleLoading(true);
    try {
      await loginWithGoogle(accessToken);
      router.push('/dashboard');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : tLogin('googleError'));
    } finally {
      setIsGoogleLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (password !== confirmPassword) {
      setError(t('errors.passwordMismatch'));
      return;
    }
    if (password.length < 6) {
      setError(t('errors.passwordLength'));
      return;
    }

    setIsLoading(true);
    try {
      // Email verification is disabled — register then auto-login straight to the console.
      await register(email, password);
      await login(email, password);
      router.push('/dashboard');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : t('errors.default'));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div>
      <AuthHeading title={t('title')} subtitle={tLogin('subtitle')} />

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
          <Label htmlFor="password">{t('password')}</Label>
          <PasswordInput
            id="password"
            autoComplete="new-password"
            placeholder={t('passwordPlaceholder')}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={6}
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
            minLength={6}
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
                {tLogin('orContinueWith')}
              </span>
            </div>
          </div>
          <GoogleSignInButton
            onSuccess={handleGoogleSuccess}
            onError={() => setError(tLogin('googleError'))}
            isLoading={isGoogleLoading}
            disabled={isLoading || isGoogleLoading}
          />
        </>
      )}

      <p className="mt-7 text-center font-mono text-[13px] text-ink-dim">
        {t('hasAccount')}{' '}
        <Link href="/login" className="text-primary hover:underline">
          {t('signIn')}
        </Link>
      </p>
    </div>
  );
}
