'use client';

import { useEffect, useState } from 'react';
import { ProtectedRoute } from '@/app/shared/auth/protected-route';
import { authService } from '@/lib/contexts/auth-service';
import { Sidebar } from './components/sidebar';
import { Topbar } from './components/topbar';
import { ImpersonationBanner } from './components/impersonation-banner';
import { cn } from '@/lib/utils';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const [mobileOpen, setMobileOpen] = useState(false);

  // Refresh the access token once when the authenticated app mounts (public
  // pages skip this to avoid needless API calls).
  useEffect(() => {
    if (authService.getRefreshToken()) {
      void authService.refreshToken();
    }
  }, []);

  return (
    <ProtectedRoute>
      <div className="relative min-h-screen bg-background">
        {/* faint grid atmosphere */}
        <div className="pointer-events-none fixed inset-0 bg-grid-fine opacity-40" />

        {/* desktop sidebar */}
        <aside className="fixed inset-y-0 left-0 z-40 hidden w-64 border-r border-line lg:block">
          <Sidebar />
        </aside>

        {/* mobile drawer */}
        <div
          className={cn(
            'fixed inset-0 z-50 lg:hidden',
            mobileOpen ? 'pointer-events-auto' : 'pointer-events-none',
          )}
          aria-hidden={!mobileOpen}
        >
          <div
            className={cn(
              'absolute inset-0 bg-black/70 transition-opacity',
              mobileOpen ? 'opacity-100' : 'opacity-0',
            )}
            onClick={() => setMobileOpen(false)}
          />
          <div
            className={cn(
              'absolute inset-y-0 left-0 w-72 max-w-[85vw] border-r border-line shadow-2xl transition-transform duration-300',
              mobileOpen ? 'translate-x-0' : '-translate-x-full',
            )}
          >
            <Sidebar onNavigate={() => setMobileOpen(false)} />
          </div>
        </div>

        {/* content column */}
        <div className="relative lg:pl-64">
          <Topbar onOpenMenu={() => setMobileOpen(true)} />
          <ImpersonationBanner />
          <main className="mx-auto w-full max-w-6xl px-4 py-6 lg:px-8 lg:py-8">{children}</main>
        </div>
      </div>
    </ProtectedRoute>
  );
}
