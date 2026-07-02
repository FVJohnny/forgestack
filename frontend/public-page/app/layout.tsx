import type React from 'react';
import type { Metadata } from 'next';
import { Geist, JetBrains_Mono } from 'next/font/google';
import { BRAND } from '@/lib/brand';
import { Toaster } from 'sonner';
import { NextIntlClientProvider } from 'next-intl';
import { getLocale, getMessages } from 'next-intl/server';
import { AuthProvider } from '@/lib/contexts/auth-context';
import { UserProvider } from '@/lib/contexts/user-context';
import { GoogleAuthProvider } from '@/lib/contexts/google-oauth-provider';
import { TooltipProvider } from '@/app/shared/ui/tooltip';
import './globals.css';

const geist = Geist({ subsets: ['latin'], variable: '--font-sans' });
const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  variable: '--font-jetbrains-mono',
});

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: `${BRAND.name} — ${BRAND.tagline}`,
    description: BRAND.tagline,
    icons: {
      icon: '/icon.svg',
      apple: '/icon.svg',
    },
  };
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const locale = await getLocale();
  const messages = await getMessages();
  // Pass the current time to ensure consistent hydration for relative time formatting
  const now = new Date();

  return (
    <html lang={locale} className="scroll-smooth overflow-x-hidden">
      <body
        className={`${geist.variable} ${jetbrainsMono.variable} font-sans antialiased overflow-x-hidden`}
      >
        <NextIntlClientProvider messages={messages} now={now} timeZone="UTC">
          <TooltipProvider delayDuration={100}>
            <GoogleAuthProvider>
              <AuthProvider>
                <UserProvider>
                  {children}
                  <Toaster
                    position="top-right"
                    theme="dark"
                    toastOptions={{
                      style: {
                        background: '#121419',
                        border: '1px solid rgba(255,255,255,0.08)',
                        color: '#e8e6e0',
                        fontFamily: 'var(--font-jetbrains-mono), monospace',
                        fontSize: '13px',
                      },
                    }}
                  />
                </UserProvider>
              </AuthProvider>
            </GoogleAuthProvider>
          </TooltipProvider>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
