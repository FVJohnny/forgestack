'use client';

import { useTransition, useEffect } from 'react';
import { useLocale } from 'next-intl';
import Image from 'next/image';
import { ChevronDown, Check } from 'lucide-react';
import { locales, localeNames, localeFlagCodes, type Locale } from '@/i18n/config';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from '@/app/shared/ui/dropdown-menu';

const LOCALE_STORAGE_KEY = 'preferred_locale';
const LOCALE_COOKIE_NAME = 'NEXT_LOCALE';

function setLocaleCookie(locale: Locale) {
  document.cookie = `${LOCALE_COOKIE_NAME}=${locale};path=/;max-age=31536000;SameSite=Lax`;
}

function getStoredLocale(): Locale | null {
  if (typeof window === 'undefined') return null;
  const stored = localStorage.getItem(LOCALE_STORAGE_KEY);
  return stored && locales.includes(stored as Locale) ? (stored as Locale) : null;
}

function FlagImage({ code, size = 20 }: { code: string; size?: number }) {
  return (
    <Image
      src={`https://flagcdn.com/w40/${code}.png`}
      alt={code}
      width={40}
      height={30}
      style={{ width: size, height: 'auto' }}
      className="rounded-[2px] object-cover"
      unoptimized
    />
  );
}

export function LanguageSwitcher() {
  const locale = useLocale() as Locale;
  const [isPending, startTransition] = useTransition();

  // Keep the stored preference and cookie in sync on mount.
  useEffect(() => {
    const storedLocale = getStoredLocale();
    if (storedLocale && storedLocale !== locale) {
      setLocaleCookie(storedLocale);
      window.location.reload();
    } else if (!storedLocale) {
      localStorage.setItem(LOCALE_STORAGE_KEY, locale);
      setLocaleCookie(locale);
    }
  }, [locale]);

  const handleChange = (newLocale: Locale) => {
    if (newLocale === locale) return;
    startTransition(() => {
      localStorage.setItem(LOCALE_STORAGE_KEY, newLocale);
      setLocaleCookie(newLocale);
      window.location.reload();
    });
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          disabled={isPending}
          aria-label="Change language"
          className="flex items-center gap-1.5 rounded-md border border-line-strong bg-white/[0.03] px-2 py-1.5 transition-colors hover:border-primary/40 hover:bg-white/5 disabled:cursor-not-allowed disabled:opacity-60"
        >
          <FlagImage code={localeFlagCodes[locale]} size={22} />
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
            <FlagImage code={localeFlagCodes[loc]} size={20} />
            <span className="flex-1">{localeNames[loc]}</span>
            {loc === locale && <Check className="size-3.5 text-primary" />}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
