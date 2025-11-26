import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import {
  signIn as cognitoSignIn,
  signUp as cognitoSignUp,
  confirmSignUp as cognitoConfirmSignUp,
  signOut as cognitoSignOut,
  getCurrentUser,
  getUserAttributes,
  signInWithGoogle as cognitoSignInWithGoogle,
} from "@/lib/cognito";

/**
 * User type
 */
export interface User {
  email: string;
  name?: string;
  sub: string; // Cognito user ID
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
  isAuthenticated: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

/**
 * AuthProvider component
 */
export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  // Load user from session on mount
  useEffect(() => {
    checkAuth();
  }, []);

  /**
   * Check if user is authenticated
   */
  const checkAuth = async () => {
    console.log("🔍 [AuthContext] Checking auth...");
    try {
      const cognitoUser = await getCurrentUser();
      console.log("🔍 [AuthContext] Cognito user:", cognitoUser);

      if (cognitoUser) {
        const attributes = await getUserAttributes();
        console.log("🔍 [AuthContext] User attributes:", attributes);

        if (attributes) {
          const userData = {
            email: attributes.email,
            name: attributes.name,
            sub: attributes.sub,
          };
          console.log("[AuthContext] Setting user:", userData);
          setUser(userData);
        } else {
          console.log("[AuthContext] No attributes found");
        }
      } else {
        console.log("[AuthContext] No Cognito user found");
      }
    } catch (error) {
      console.error("[AuthContext] Check auth error:", error);
    } finally {
      setLoading(false);
      console.log("[AuthContext] Loading complete");
    }
  };

  /**
   * Sign in with email/password
   */
  const signIn = async (email: string, password: string) => {
    try {
      await cognitoSignIn(email, password);
      console.log("✅ [AuthContext] Sign in success");

      // Reload user data
      await checkAuth();
    } catch (error: any) {
      console.error("❌ [AuthContext] Sign in error:", error);

      // Handle "There is already a signed in user" error
      if (error.message && error.message.includes("There is already a signed in user")) {
        console.log("[AuthContext] User already signed in, signing out and retrying...");
        await cognitoSignOut();
        try {
          await cognitoSignIn(email, password);
          console.log("[AuthContext] Retry sign in success");
          await checkAuth();
          return;
        } catch (retryError: any) {
          console.error("[AuthContext] Retry sign in error:", retryError);
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
      console.log("[AuthContext] Sign up success");
    } catch (error: any) {
      console.error("[AuthContext] Sign up error:", error);
      throw new Error(error.message || "Đăng ký thất bại");
    }
  };

  /**
   * Confirm sign up with verification code
   */
  const confirmSignUp = async (email: string, code: string) => {
    try {
      await cognitoConfirmSignUp(email, code);
      console.log("[AuthContext] Confirm sign up success");
    } catch (error: any) {
      console.error("[AuthContext] Confirm sign up error:", error);
      throw new Error(error.message || "Xác nhận thất bại");
    }
  };

  /**
   * Sign out
   */
  const signOut = async () => {
    try {
      await cognitoSignOut();
      setUser(null);
      console.log("[AuthContext] Sign out success");
    } catch (error) {
      console.error("[AuthContext] Sign out error:", error);
    }
  };

  /**
   * Sign in with Google (redirect to Cognito Hosted UI)
   */
  const signInWithGoogle = async () => {
    try {
      console.log("[AuthContext] Starting Google sign in...");
      await cognitoSignInWithGoogle();
    } catch (error) {
      console.error("[AuthContext] Google sign in error:", error);
    }
  };

  const value: AuthContextType = {
    user,
    loading,
    signIn,
    signUp,
    confirmSignUp,
    signOut,
    signInWithGoogle,
    refreshAuth: checkAuth,
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
