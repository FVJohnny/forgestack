'use client';

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useMemo,
  type ReactNode,
} from 'react';
import { authService } from './auth-service';

interface AuthContextType {
  isAuthenticated: boolean;
  userId: string | null;
  register: (email: string, password: string) => Promise<void>;
  login: (email: string, password: string) => Promise<void>;
  loginWithGoogle: (accessToken: string) => Promise<void>;
  logout: () => Promise<void>;
  isLoading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Tokens live in httpOnly cookies the browser can't read, so the session is
  // established by asking the API who we are. getSession() transparently
  // refreshes via the cookie on a 401 before giving up.
  useEffect(() => {
    let cancelled = false;
    void authService.getSession().then((me) => {
      if (cancelled) return;
      setIsAuthenticated(Boolean(me));
      setUserId(me?.userId ?? null);
      setIsLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  // The API client fires this when a refresh fails, so the app drops to logged
  // out without every caller having to handle it.
  useEffect(() => {
    const onUnauthenticated = () => {
      setIsAuthenticated(false);
      setUserId(null);
    };
    window.addEventListener('auth:unauthenticated', onUnauthenticated);
    return () => window.removeEventListener('auth:unauthenticated', onUnauthenticated);
  }, []);

  const register = useCallback(async (email: string, password: string) => {
    await authService.register(email, password);
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const response = await authService.login(email, password);
    setIsAuthenticated(true);
    setUserId(response.userId);
  }, []);

  const loginWithGoogle = useCallback(async (accessToken: string) => {
    const response = await authService.loginWithGoogle(accessToken);
    setIsAuthenticated(true);
    setUserId(response.userId);
  }, []);

  const logout = useCallback(async () => {
    await authService.logout();
    setIsAuthenticated(false);
    setUserId(null);
  }, []);

  const value = useMemo(
    () => ({ isAuthenticated, userId, register, login, loginWithGoogle, logout, isLoading }),
    [isAuthenticated, userId, register, login, loginWithGoogle, logout, isLoading],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
