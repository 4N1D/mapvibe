import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { getCurrentUser, signOut, fetchAuthSession, AuthUser } from 'aws-amplify/auth';
import { Hub } from 'aws-amplify/utils';
import { apiClient } from '../lib/api';

interface User {
  id: string;
  email?: string;
  display_name?: string;
  avatar?: string;
  roles?: string[];
}

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  isAdmin: boolean;
  signOut: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const fetchUserProfile = async (userId: string, email: string | undefined, roles: string[]) => {
    try {
      const response = await apiClient.get('/users/me');
      const profile = response.data.user;
      
      setUser({
        id: userId,
        email: profile?.email || email,
        display_name: profile?.display_name,
        avatar: profile?.avatar,
        roles: roles,
      });
    } catch (err) {
      console.error('Failed to fetch user profile:', err);
      // Fallback to basic user info
      setUser({
        id: userId,
        email: email,
        roles: roles,
      });
    }
  };

  const checkUser = async () => {
    try {
      const currentUser: AuthUser = await getCurrentUser();
      const session = await fetchAuthSession();
      const idToken = session.tokens?.idToken;
      
      const roles = idToken?.payload['custom:roles'] as string | undefined;
      const parsedRoles = roles ? JSON.parse(roles) : ['user'];
      const email = idToken?.payload.email as string | undefined;

      // Set basic user info first (for quick render)
      setUser({
        id: currentUser.userId,
        email: email,
        roles: parsedRoles,
      });

      // Then fetch full profile from API
      await fetchUserProfile(currentUser.userId, email, parsedRoles);
    } catch {
      setUser(null);
    } finally {
      setIsLoading(false);
    }
  };

  const refreshUser = async () => {
    if (user) {
      await fetchUserProfile(user.id, user.email, user.roles || []);
    }
  };

  useEffect(() => {
    checkUser();

    const unsubscribe = Hub.listen('auth', ({ payload }) => {
      switch (payload.event) {
        case 'signedIn':
          checkUser();
          break;
        case 'signedOut':
          setUser(null);
          break;
      }
    });

    return unsubscribe;
  }, []);

  const handleSignOut = async () => {
    await signOut();
    setUser(null);
  };

  const isAdmin = user?.roles?.includes('admin') || false;

  return (
    <AuthContext.Provider value={{ user, isLoading, isAdmin, signOut: handleSignOut, refreshUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
}
