'use client';

import { useEffect, useState } from 'react';
import { useFormatter, useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { Card } from '@/app/shared/ui/card';
import { Button } from '@/app/shared/ui/button';
import { Label } from '@/app/shared/ui/label';
import { adminService } from '@/lib/api/services/admin.service';
import { dashboardService } from '@/lib/api/services/dashboard.service';
import type { GetMotdResponse } from '@/lib/api/types';

export function MotdEditor() {
  const t = useTranslations('fmf.admin.motd');
  const format = useFormatter();
  const [content, setContent] = useState('');
  const [current, setCurrent] = useState<GetMotdResponse | null>(null);
  const [saving, setSaving] = useState(false);
  const [clearing, setClearing] = useState(false);

  useEffect(() => {
    dashboardService
      .getMotd()
      .then((m) => {
        setCurrent(m);
        setContent(m?.content ?? '');
      })
      .catch(() => {});
  }, []);

  const save = async () => {
    if (!content.trim()) {
      toast.error(t('toast.empty'));
      return;
    }
    setSaving(true);
    try {
      await adminService.setMotd(content.trim());
      const fresh = await dashboardService.getMotd();
      setCurrent(fresh);
      toast.success(t('toast.saved'));
    } catch {
      toast.error(t('toast.saveFailed'));
    } finally {
      setSaving(false);
    }
  };

  const clear = async () => {
    setClearing(true);
    try {
      await adminService.deleteMotd();
      setCurrent(null);
      setContent('');
      toast.success(t('toast.cleared'));
    } catch {
      toast.error(t('toast.clearFailed'));
    } finally {
      setClearing(false);
    }
  };

  return (
    <Card className="gap-0 py-0">
      <div className="border-b border-line px-5 py-4">
        <h2 className="font-mono text-[13px] font-semibold uppercase tracking-[0.12em] text-ink">
          {t('title')}
        </h2>
      </div>
      <div className="space-y-4 px-5 py-5">
        <div className="space-y-2">
          <Label htmlFor="motd">{t('label')}</Label>
          <textarea
            id="motd"
            value={content}
            onChange={(e) => setContent(e.target.value)}
            rows={4}
            placeholder={t('placeholder')}
            className="w-full resize-y rounded-md border border-line-strong bg-base-2/60 px-3 py-2.5 font-mono text-sm leading-relaxed text-ink shadow-inner outline-none transition-colors placeholder:text-ink-faint focus-visible:border-primary/60 focus-visible:ring-2 focus-visible:ring-primary/20 scrollbar-thin"
          />
          <p className="font-mono text-[11px] text-ink-faint">
            {current
              ? t('updated', {
                  time: format.dateTime(new Date(current.updatedAt), {
                    month: 'short',
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                  }),
                })
              : t('empty')}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button onClick={save} disabled={saving}>
            {saving ? t('saving') : t('save')}
          </Button>
          <Button variant="destructive" onClick={clear} disabled={clearing || !current}>
            {clearing ? t('clearing') : t('clear')}
          </Button>
        </div>
      </div>
    </Card>
  );
}
