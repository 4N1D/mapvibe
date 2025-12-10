import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from "react";
import {
  signIn as cognitoSignIn,
  signUp as cognitoSignUp,
  confirmSignUp as cognitoConfirmSignUp,
  signOut as cognitoSignOut,
  getCurrentUser,
  getUserAttributes,
  signInWithGoogle as cognitoSignInWithGoogle,
} from "@/lib/cognito";
import { Hub } from "aws-amplify/utils";
import { apiClient } from "@/lib/axios";
import { trackActivityImmediate } from "@/lib/activityTracker";

/**
 * User type
 */
export interface User {
  email: string;
  name?: string;
  sub: string; // Cognito user ID
  avatar?: string;
  isOAuthUser?: boolean; // true if user signed up via Google/OAuth
}

/**
 * Auth context type
 */
interface AuthContextType {
  user: User | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string, name?: string) => Promise<void>;
  confirmSignUp: (email: string, code: string) => Promise<void>;
  signOut: () => Promise<void>;
  signInWithGoogle: () => Promise<void>;
  refreshAuth: () => Promise<void>;
  updateUserAvatar: (avatarUrl: string) => void;
  isAuthenticated: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

/**
 * AuthProvider component
 */
export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  /**
   * Check if user is authenticated
   */
  const checkAuth = useCallback(async () => {
    try {
      const cognitoUser = await getCurrentUser();

      if (cognitoUser) {
        const attributes = await getUserAttributes();

        if (attributes) {
          const userData: User = {
            email: attributes.email || "",
            name: attributes.name || attributes.email || cognitoUser.username,
            sub: attributes.sub || cognitoUser.userId,
            isOAuthUser: attributes.isOAuthUser === "true",
          };

          // Fetch user profile to get avatar
          try {
            const response = await apiClient.get<{
              user: { avatar?: string; display_name?: string };
            }>("/users/me");
            if (response.data?.user) {
              userData.avatar = response.data.user.avatar;
              if (response.data.user.display_name) {
                userData.name = response.data.user.display_name;
              }
            }
          } catch (apiError) {
            console.warn("[Auth] Failed to fetch user profile:", apiError);
          }

          setUser(userData);
        } else {
          setUser(null);
        }
      } else {
        setUser(null);
      }
    } catch (error) {
      console.error("[Auth] Check auth failed:", error);
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  // Load user from session on mount and listen for OAuth events
  useEffect(() => {
    const hubListenerCancelToken = Hub.listen("auth", ({ payload }) => {
      switch (payload.event) {
        case "signedIn":
        case "signInWithRedirect":
          checkAuth();
          trackActivityImmediate("login", { metadata: { method: "google" } });
          break;
        case "signInWithRedirect_failure":
          console.error("[Auth] OAuth login failed:", payload.data);
          break;
        case "signedOut":
          setUser(null);
          break;
      }
    });

    // Listen for user-banned event from axios interceptor
    const handleUserBanned = async () => {
      console.warn("[Auth] User banned - forcing logout");
      await cognitoSignOut();
      setUser(null);
      alert("Tài khoản của bạn đã bị cấm. Vui lòng liên hệ quản trị viên.");
    };
    window.addEventListener("user-banned", handleUserBanned);

    // Initial auth check
    checkAuth();

    // Cleanup listener on unmount
    return () => {
      hubListenerCancelToken();
      window.removeEventListener("user-banned", handleUserBanned);
    };
  }, [checkAuth]);

  /**
   * Sign in with email/password
   */
  const signIn = async (email: string, password: string) => {
    try {
      await cognitoSignIn(email, password);
      await checkAuth();
      // Track login activity
      trackActivityImmediate("login", { metadata: { method: "email" } });
    } catch (error: any) {
      // Handle "There is already a signed in user" error
      if (error.message?.includes("There is already a signed in user")) {
        await cognitoSignOut();
        try {
          await cognitoSignIn(email, password);
          await checkAuth();
          trackActivityImmediate("login", { metadata: { method: "email" } });
          return;
        } catch (retryError: any) {
          throw new Error(retryError.message || "Đăng nhập thất bại");
        }
      }

      throw new Error(error.message || "Đăng nhập thất bại");
    }
  };

  /**
   * Sign up with email/password
   */
  const signUp = async (email: string, password: string, name?: string) => {
    try {
      await cognitoSignUp(email, password, { name });
      // Track register activity
      trackActivityImmediate("register", { metadata: { method: "email" } });
    } catch (error: any) {
      throw new Error(error.message || "Đăng ký thất bại");
    }
  };

  /**
   * Confirm sign up with verification code
   */
  const confirmSignUp = async (email: string, code: string) => {
    try {
      await cognitoConfirmSignUp(email, code);
    } catch (error: any) {
      throw new Error(error.message || "Xác nhận thất bại");
    }
  };

  /**
   * Sign out - always clears local state even if API fails
   */
  const signOut = async () => {
    // Track logout before signing out
    trackActivityImmediate("logout");
    try {
      await cognitoSignOut();
    } catch (error) {
      console.error("[Auth] Sign out failed:", error);
    } finally {
      // Always clear user state, even if Cognito signOut fails
      // This ensures user is logged out on client side
      setUser(null);
    }
  };

  /**
   * Sign in with Google OAuth
   */
  const signInWithGoogle = async () => {
    try {
      await cognitoSignInWithGoogle();
    } catch (error) {
      console.error("[Auth] Google sign in failed:", error);
    }
  };

  /**
   * Update user avatar (for smooth UX without refetching)
   */
  const updateUserAvatar = useCallback((avatarUrl: string) => {
    setUser((prev) => (prev ? { ...prev, avatar: avatarUrl } : null));
  }, []);

  const value: AuthContextType = {
    user,
    loading,
    signIn,
    signUp,
    confirmSignUp,
    signOut,
    signInWithGoogle,
    refreshAuth: checkAuth,
    updateUserAvatar,
    isAuthenticated: !!user,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

/**
 * useAuth hook
 */
export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return context;
};
