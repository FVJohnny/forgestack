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
import { authService } from '@/lib/contexts/auth-service';
import { APIError } from '@/lib/api/client';
import type { GetMeResponse } from '@/lib/api/types';
import { useAuth } from './auth-context';

interface UserContextType {
  user: GetMeResponse | null;
  isLoading: boolean;
  refetch: () => Promise<void>;
}

const UserContext = createContext<UserContextType | undefined>(undefined);

export function UserProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<GetMeResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const { isAuthenticated, logout } = useAuth();

  // Fetch user profile
  const fetchUser = useCallback(async () => {
    try {
      const token = authService.getAccessToken();
      if (!token) {
        setUser(null);
        setIsLoading(false);
        await logout();
        return;
      }

      const userData = await authService.getMe();
      setUser(userData);
    } catch (error) {
      console.error('Error fetching user:', error);
      setUser(null);

      if (error instanceof APIError && error.status === 401) {
        await logout();
      }
    } finally {
      setIsLoading(false);
    }
  }, [logout]);

  // Fetch user when authenticated
  useEffect(() => {
    if (isAuthenticated) {
      fetchUser();
    } else {
      setUser(null);
      setIsLoading(false);
    }
  }, [isAuthenticated, fetchUser]);

  const refetch = useCallback(async () => {
    await fetchUser();
  }, [fetchUser]);

  const value = useMemo(
    () => ({
      user,
      isLoading,
      refetch,
    }),
    [user, isLoading, refetch],
  );

  return <UserContext.Provider value={value}>{children}</UserContext.Provider>;
}

export function useUser() {
  const context = useContext(UserContext);
  if (context === undefined) {
    throw new Error('useUser must be used within a UserProvider');
  }
  return context;
}
