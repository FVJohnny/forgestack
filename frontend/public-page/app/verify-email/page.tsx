import { Suspense } from 'react';
import { useTranslations } from 'next-intl';
import { AuthShell } from '@/app/shared/auth/auth-shell';
import { VerifyEmailContent } from './components/verify-email-content';

function VerifyEmailFallback() {
  const t = useTranslations('auth.verifyEmail.loading');
  return (
    <div className="flex flex-col items-center gap-4 py-10 text-center">
      <div className="size-12 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      <p className="font-mono text-sm text-ink-dim">{t('title')}</p>
    </div>
  );
}

export default function VerifyEmailPage() {
  return (
    <AuthShell>
      <Suspense fallback={<VerifyEmailFallback />}>
        <VerifyEmailContent />
      </Suspense>
    </AuthShell>
  );
}
