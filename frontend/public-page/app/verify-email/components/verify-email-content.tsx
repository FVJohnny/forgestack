'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Button } from '@/app/shared/ui/button';
import { FormAlert } from '@/app/shared/ui/form-alert';
import { authService } from '@/lib/contexts/auth-service';
import { CheckCircle2, XCircle, Loader2 } from 'lucide-react';

type VerificationStatus = 'loading' | 'success' | 'error';

export function VerifyEmailContent() {
  const t = useTranslations('auth.verifyEmail');
  const router = useRouter();
  const searchParams = useSearchParams();
  const [status, setStatus] = useState<VerificationStatus>('loading');
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    let isMounted = true;
    const verifyEmail = async () => {
      const emailVerificationId = searchParams.get('id');
      if (!emailVerificationId) {
        if (isMounted) {
          setStatus('error');
          setErrorMessage(t('errors.noId'));
        }
        return;
      }
      try {
        await authService.verifyEmailAndLogin(emailVerificationId);
        if (isMounted) setStatus('success');
      } catch (err) {
        if (isMounted) {
          setStatus('error');
          setErrorMessage(err instanceof Error ? err.message : t('errors.default'));
        }
      }
    };
    verifyEmail();
    return () => {
      isMounted = false;
    };
  }, [searchParams, t]);

  useEffect(() => {
    if (status === 'success') {
      const timer = setTimeout(() => {
        window.location.href = '/dashboard';
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, [status]);

  if (status === 'loading') {
    return (
      <div className="flex flex-col items-center gap-4 py-8 text-center">
        <Loader2 className="size-14 animate-spin text-primary" />
        <h1 className="text-2xl font-semibold tracking-tight text-ink">{t('loading.title')}</h1>
        <p className="text-sm text-ink-dim">{t('loading.description')}</p>
      </div>
    );
  }

  if (status === 'success') {
    return (
      <div className="flex flex-col items-center gap-5 py-8 text-center">
        <CheckCircle2 className="size-14 text-primary text-phosphor-glow" />
        <div className="space-y-2">
          <h1 className="text-2xl font-semibold tracking-tight text-ink">{t('success.title')}</h1>
          <p className="text-sm text-ink-dim">{t('success.description')}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center gap-5 py-8 text-center">
      <XCircle className="size-14 text-[var(--red)]" />
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight text-ink">{t('error.title')}</h1>
        <FormAlert kind="error">{errorMessage}</FormAlert>
        <p className="text-sm text-ink-dim">{t('error.tryAgain')}</p>
      </div>
      <Button onClick={() => router.push('/login')} className="w-full" size="lg">
        {t('error.goToSignIn')}
      </Button>
    </div>
  );
}
