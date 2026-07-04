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
  loginWithGoogle: (idToken: string) => Promise<void>;
  logout: () => Promise<void>;
  isLoading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Check if user is already logged in on mount
  useEffect(() => {
    const token = authService.getAccessToken();
    const storedUserId = authService.getUserId();

    if (token && storedUserId) {
      setIsAuthenticated(true);
      setUserId(storedUserId);
    }
    setIsLoading(false);
  }, []);

  // Note: Token refresh is handled in dashboard layout to avoid API calls on public pages

  const register = useCallback(async (email: string, password: string) => {
    await authService.register(email, password);
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const response = await authService.login(email, password);
    setIsAuthenticated(true);
    setUserId(response.userId);
  }, []);

  const loginWithGoogle = useCallback(async (idToken: string) => {
    const response = await authService.loginWithGoogle(idToken);
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
