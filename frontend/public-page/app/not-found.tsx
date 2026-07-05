import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { Button } from '@/app/shared/ui/button';

export default async function NotFound() {
  const t = await getTranslations('app.notFound');
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="space-y-4 text-center">
        <p className="font-mono text-sm text-ink-dim">404</p>
        <h2 className="text-xl font-semibold text-foreground">{t('title')}</h2>
        <p className="text-sm text-muted-foreground">{t('description')}</p>
        <Button asChild variant="primary">
          <Link href="/">{t('backToHome')}</Link>
        </Button>
      </div>
    </div>
  );
}
