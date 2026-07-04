'use client';

import { useTransition } from 'react';
import { useLocale } from 'next-intl';
import { ChevronDown, Check } from 'lucide-react';
import { locales, localeNames, localeFlags, type Locale } from '@/i18n/config';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from '@/app/shared/ui/dropdown-menu';

const LOCALE_COOKIE_NAME = 'NEXT_LOCALE';

function setLocaleCookie(locale: Locale) {
  document.cookie = `${LOCALE_COOKIE_NAME}=${locale};path=/;max-age=31536000;SameSite=Lax`;
}

export function LanguageSwitcher() {
  const locale = useLocale() as Locale;
  const [isPending, startTransition] = useTransition();

  // No mount-time reconciliation: the cookie is the single source of truth
  // (set on change below), and next-intl reads it server-side. The previous
  // reload-on-mount could loop forever when cookies were blocked.
  const handleChange = (newLocale: Locale) => {
    if (newLocale === locale) return;
    startTransition(() => {
      setLocaleCookie(newLocale);
      // A reload re-runs the server layout so next-intl serves the new locale.
      window.location.reload();
    });
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          disabled={isPending}
          aria-label={`Change language (current: ${localeNames[locale]})`}
          className="flex items-center gap-1.5 rounded-md border border-line-strong bg-white/[0.03] px-2 py-1.5 transition-colors hover:border-primary/40 hover:bg-white/5 disabled:cursor-not-allowed disabled:opacity-60"
        >
          <span className="text-base leading-none" aria-hidden="true">
            {localeFlags[locale]}
          </span>
          <ChevronDown className="size-3.5 text-ink-faint" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-[180px] border-line bg-popover text-ink">
        {locales.map((loc) => (
          <DropdownMenuItem
            key={loc}
            onSelect={() => handleChange(loc)}
            className="cursor-pointer gap-3"
          >
            <span className="text-base leading-none" aria-hidden="true">
              {localeFlags[loc]}
            </span>
            <span className="flex-1">{localeNames[loc]}</span>
            {loc === locale && <Check className="size-3.5 text-primary" />}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
