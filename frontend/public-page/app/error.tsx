'use client';

import { useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { Button } from '@/app/shared/ui/button';

// Route-level error boundary (catches errors within the app segment). It renders
// inside the root layout's NextIntlClientProvider, so it can localize its copy.
// The root-layout errors (where the provider itself may be down) are caught by
// global-error.tsx, which stays English on purpose.
export default function RouteError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const t = useTranslations('app.error');

  useEffect(() => {
    console.error('Unhandled error:', error);
  }, [error]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="text-center space-y-4">
        <h2 className="text-xl font-semibold text-foreground">{t('title')}</h2>
        <p className="text-sm text-muted-foreground">{t('description')}</p>
        <Button variant="primary" onClick={reset}>
          {t('retry')}
        </Button>
      </div>
    </div>
  );
}
