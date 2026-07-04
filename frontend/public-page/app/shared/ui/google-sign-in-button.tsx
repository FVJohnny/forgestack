'use client';

import { useGoogleLogin } from '@react-oauth/google';
import { Button } from '@/app/shared/ui/button';
import { useTranslations } from 'next-intl';

interface GoogleSignInButtonProps {
  onSuccess: (credential: string) => void;
  onError?: () => void;
  isLoading?: boolean;
  disabled?: boolean;
  className?: string;
}

export function GoogleSignInButton({
  onSuccess,
  onError,
  isLoading = false,
  disabled = false,
  className = '',
}: GoogleSignInButtonProps) {
  const t = useTranslations('auth');

  const login = useGoogleLogin({
    onSuccess: async (tokenResponse) => {
      try {
        // Exchange access token for ID token by calling Google's userinfo endpoint
        // and then get the ID token from the token response
        // Note: useGoogleLogin with flow: 'implicit' gives us an access_token
        // We need to use flow: 'auth-code' and exchange on backend, OR
        // use the GoogleLogin button which gives us credential (ID token) directly
        // For simplicity, we'll use the access_token and verify on backend
        onSuccess(tokenResponse.access_token);
      } catch (error) {
        console.error('Google login error:', error);
        onError?.();
      }
    },
    onError: () => {
      console.error('Google login failed');
      onError?.();
    },
  });

  // Check if Google OAuth is configured
  const isConfigured = !!process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;

  if (!isConfigured) {
    return null;
  }

  return (
    <Button
      type="button"
      variant="outline"
      onClick={() => login()}
      disabled={disabled || isLoading}
      className={`w-full flex items-center justify-center gap-2 hover:bg-primary hover:text-primary-foreground ${className}`}
    >
      <svg className="h-5 w-5" viewBox="0 0 24 24">
        <path
          fill="currentColor"
          d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
        />
        <path
          fill="currentColor"
          d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
        />
        <path
          fill="currentColor"
          d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
        />
        <path
          fill="currentColor"
          d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
        />
      </svg>
      {isLoading ? t('login.loading') : t('login.googleButton')}
    </Button>
  );
}
