import type { AuthProvider } from '@refinedev/core';
import { getCurrentUser, signOut, fetchAuthSession, signInWithRedirect } from 'aws-amplify/auth';

export const authProvider: AuthProvider = {
  login: async () => {
    try {
      await signInWithRedirect({ provider: 'Google' });
      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: {
          name: 'LoginError',
          message: 'Failed to login',
        },
      };
    }
  },

  logout: async () => {
    try {
      await signOut();
      return {
        success: true,
        redirectTo: '/login',
      };
    } catch (error) {
      return {
        success: false,
        error: {
          name: 'LogoutError',
          message: 'Failed to logout',
        },
      };
    }
  },

  check: async () => {
    try {
      await getCurrentUser();
      const session = await fetchAuthSession();
      const idToken = session.tokens?.idToken;
      
      // Check admin role
      const rolesStr = idToken?.payload['custom:roles'] as string | undefined;
      let roles: string[] = [];
      
      try {
        roles = rolesStr ? JSON.parse(rolesStr) : [];
      } catch {
        roles = typeof rolesStr === 'string' ? [rolesStr] : [];
      }
      
      if (!roles.includes('admin')) {
        return {
          authenticated: false,
          error: {
            name: 'Unauthorized',
            message: 'You do not have admin permissions',
          },
          redirectTo: '/login',
        };
      }

      return {
        authenticated: true,
      };
    } catch (error) {
      return {
        authenticated: false,
        redirectTo: '/login',
      };
    }
  },

  getPermissions: async () => {
    try {
      const session = await fetchAuthSession();
      const idToken = session.tokens?.idToken;
      const rolesStr = idToken?.payload['custom:roles'] as string | undefined;
      
      try {
        return rolesStr ? JSON.parse(rolesStr) : [];
      } catch {
        return typeof rolesStr === 'string' ? [rolesStr] : [];
      }
    } catch {
      return [];
    }
  },

  getIdentity: async () => {
    try {
      const user = await getCurrentUser();
      const session = await fetchAuthSession();
      const idToken = session.tokens?.idToken;

      return {
        id: user.userId,
        name: idToken?.payload.email as string,
        email: idToken?.payload.email as string,
        avatar: idToken?.payload.picture as string | undefined,
      };
    } catch {
      return null;
    }
  },

  onError: async (error) => {
    console.error('Auth error:', error);
    return { error };
  },
};
