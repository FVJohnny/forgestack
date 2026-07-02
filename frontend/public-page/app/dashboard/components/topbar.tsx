'use client';

import { useMemo } from 'react';
import { useTranslations } from 'next-intl';
import { Menu, LogOut, UserCog, ChevronDown } from 'lucide-react';
import Link from 'next/link';
import { Badge } from '@/app/shared/ui/badge';
import { LanguageSwitcher } from '@/app/shared/ui/language-switcher';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from '@/app/shared/ui/dropdown-menu';
import { useUser } from '@/lib/contexts/user-context';
import { useAuth } from '@/lib/contexts/auth-context';

const ENV = process.env.NEXT_PUBLIC_API_URL?.includes('localhost') ? 'local' : 'prod';

export function Topbar({ onOpenMenu }: { onOpenMenu: () => void }) {
  const t = useTranslations('fmf.nav');
  const { user } = useUser();
  const { logout } = useAuth();

  const initial = useMemo(() => user?.email?.[0]?.toUpperCase() ?? '·', [user?.email]);

  return (
    <header className="sticky top-0 z-30 flex h-14 items-center justify-between gap-3 border-b border-line bg-base-2/80 px-4 backdrop-blur-md lg:px-6">
      <div className="flex items-center gap-3">
        <button
          onClick={onOpenMenu}
          className="text-ink-dim hover:text-ink lg:hidden"
          aria-label="Open menu"
        >
          <Menu className="size-5" />
        </button>
        <Badge variant={ENV === 'prod' ? 'warn' : 'live'}>
          {t('env')}:{ENV}
        </Badge>
      </div>

      <div className="flex items-center gap-2">
        <LanguageSwitcher />
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="flex items-center gap-2 rounded-md border border-line-strong bg-white/[0.03] px-2 py-1.5 transition-colors hover:border-primary/40 hover:bg-white/5">
              <span className="grid size-6 place-items-center rounded-full border border-primary/40 bg-primary/15 font-mono text-[11px] font-semibold text-primary">
                {initial}
              </span>
              <span className="hidden max-w-[160px] truncate font-mono text-[12px] text-ink-dim sm:block">
                {user?.email ?? '—'}
              </span>
              <ChevronDown className="size-3.5 text-ink-faint" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            align="end"
            className="min-w-[220px] border-line bg-popover text-ink"
          >
            <DropdownMenuLabel className="text-ink-faint">{user?.role ?? 'user'}</DropdownMenuLabel>
            <DropdownMenuItem asChild>
              <Link href="/dashboard/account" className="cursor-pointer">
                <UserCog className="size-4" />
                {t('account')}
              </Link>
            </DropdownMenuItem>
            <DropdownMenuSeparator className="bg-line" />
            <DropdownMenuItem
              onClick={() => logout()}
              className="text-[var(--red)] hover:bg-[var(--red)]/10 hover:text-[var(--red)] focus:bg-[var(--red)]/10 focus:text-[var(--red)]"
            >
              <LogOut className="size-4" />
              {t('logout')}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
