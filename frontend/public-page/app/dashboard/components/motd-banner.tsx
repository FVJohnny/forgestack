'use client';

import { useTranslations } from 'next-intl';
import { Megaphone } from 'lucide-react';
import type { GetMotdResponse } from '@/lib/api/types';

export function MotdBanner({ motd }: { motd: GetMotdResponse | null }) {
  const t = useTranslations('fmf.dashboard.motd');
  if (!motd?.content) return null;

  return (
    <div className="enter mb-6 flex items-start gap-3 rounded-lg border border-[var(--amber)]/30 bg-[var(--amber)]/[0.08] px-4 py-3">
      <Megaphone className="mt-0.5 size-4 shrink-0 text-[var(--amber)]" />
      <div className="min-w-0">
        <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-[var(--amber)]">
          {t('label')}
        </span>
        <p className="mt-0.5 whitespace-pre-wrap break-words text-sm leading-relaxed text-ink">
          {motd.content}
        </p>
      </div>
    </div>
  );
}
