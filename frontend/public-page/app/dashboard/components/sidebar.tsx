'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { LayoutDashboard, UserCog, ShieldHalf, LogOut, X } from 'lucide-react';
import { Wordmark } from '@/app/shared/ui/wordmark';
import { useAuth } from '@/lib/contexts/auth-context';
import { useUser } from '@/lib/contexts/user-context';
import { cn } from '@/lib/utils';

interface NavItem {
  href: string;
  labelKey: string;
  Icon: typeof LayoutDashboard;
  adminOnly?: boolean;
}

const NAV: NavItem[] = [
  { href: '/dashboard', labelKey: 'overview', Icon: LayoutDashboard },
  { href: '/dashboard/account', labelKey: 'account', Icon: UserCog },
  { href: '/dashboard/admin', labelKey: 'admin', Icon: ShieldHalf, adminOnly: true },
];

export function Sidebar({ onNavigate }: { onNavigate?: () => void }) {
  const t = useTranslations('fmf.nav');
  const pathname = usePathname();
  const { logout } = useAuth();
  const { user } = useUser();
  const isAdmin = user?.role === 'admin';

  const items = NAV.filter((i) => !i.adminOnly || isAdmin);

  return (
    <div className="flex h-full flex-col bg-base-2">
      <div className="flex items-center justify-between border-b border-line px-5 py-5">
        <Link href="/dashboard" onClick={onNavigate}>
          <Wordmark />
        </Link>
        {onNavigate && (
          <button
            onClick={onNavigate}
            className="text-ink-faint hover:text-ink lg:hidden"
            aria-label="Close menu"
          >
            <X className="size-5" />
          </button>
        )}
      </div>

      <nav className="flex-1 overflow-y-auto px-3 py-5 scrollbar-thin">
        <p className="px-3 pb-2 font-mono text-[10px] uppercase tracking-[0.18em] text-ink-faint">
          {t('sectionMain')}
        </p>
        <ul className="space-y-1">
          {items.map(({ href, labelKey, Icon }) => {
            const active = href === '/dashboard' ? pathname === href : pathname.startsWith(href);
            return (
              <li key={href}>
                <Link
                  href={href}
                  onClick={onNavigate}
                  aria-current={active ? 'page' : undefined}
                  className={cn(
                    'group relative flex items-center gap-3 rounded-md px-3 py-2 font-mono text-[13px] transition-colors',
                    active
                      ? 'bg-primary/10 text-primary'
                      : 'text-ink-dim hover:bg-white/5 hover:text-ink',
                  )}
                >
                  {active && (
                    <span className="absolute left-0 top-1/2 h-4 w-0.5 -translate-y-1/2 rounded-full bg-primary glow-phosphor" />
                  )}
                  <Icon className="size-4 shrink-0" />
                  {t(labelKey)}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      <div className="border-t border-line p-3">
        <button
          onClick={() => logout()}
          className="flex w-full items-center gap-3 rounded-md px-3 py-2 font-mono text-[13px] text-ink-dim transition-colors hover:bg-[var(--red)]/10 hover:text-[var(--red)]"
        >
          <LogOut className="size-4" />
          {t('logout')}
        </button>
      </div>
    </div>
  );
}
