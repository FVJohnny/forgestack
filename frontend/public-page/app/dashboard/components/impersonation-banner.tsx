'use client';

import { useTranslations } from 'next-intl';
import { Eye } from 'lucide-react';
import { authService } from '@/lib/contexts/auth-service';
import { useUser } from '@/lib/contexts/user-context';

export function ImpersonationBanner() {
  const t = useTranslations('fmf.nav');
  const { user } = useUser();

  // Impersonation state is authoritative from the current token (via /auth/me),
  // not client storage: the backend sets isImpersonating on the token payload.
  if (!user?.isImpersonating) return null;

  const exit = async () => {
    try {
      await authService.stopImpersonation();
      // Full reload so every context re-reads the restored admin session.
      window.location.href = '/dashboard';
    } catch {
      // If restore failed, fall back to a clean login.
      window.location.href = '/login';
    }
  };

  return (
    <div className="flex items-center justify-between gap-3 border-b border-[var(--amber)]/30 bg-[var(--amber)]/10 px-4 py-2 lg:px-6">
      <span className="flex items-center gap-2 font-mono text-[12px] text-[var(--amber)]">
        <Eye className="size-3.5" />
        {t('impersonating')}: {user?.email ?? '—'}
      </span>
      <button
        onClick={exit}
        className="rounded-md border border-[var(--amber)]/40 px-2.5 py-1 font-mono text-[11px] uppercase tracking-[0.1em] text-[var(--amber)] transition-colors hover:bg-[var(--amber)]/15"
      >
        {t('exitImpersonation')}
      </button>
    </div>
  );
}
