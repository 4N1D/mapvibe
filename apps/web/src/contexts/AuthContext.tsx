import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import {
  signIn as cognitoSignIn,
  signUp as cognitoSignUp,
  confirmSignUp as cognitoConfirmSignUp,
  signOut as cognitoSignOut,
  getCurrentUser,
  getUserAttributes,
  getGoogleAuthUrl,
} from "@/lib/cognito";

export interface User {
  email: string;
  name?: string;
  sub: string; // Cognito user ID
}

interface AuthContextType {
  user: User | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string, name?: string) => Promise<void>;
  confirmSignUp: (email: string, code: string) => Promise<void>;
  signOut: () => void;
  signInWithGoogle: () => void;
  isAuthenticated: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    try {
      const cognitoUser = await getCurrentUser();
      if (cognitoUser) {
        const attributes = await getUserAttributes();
        if (attributes) {
          setUser({
            email: attributes.email,
            name: attributes.name,
            sub: attributes.sub,
          });
        }
      }
    } catch (error) {
      console.error("Check auth error:", error);
    } finally {
      setLoading(false);
    }
  };

  const signIn = async (email: string, password: string) => {
    try {
      await cognitoSignIn(email, password);
      console.log("Sign in success");

      // Reload user data
      await checkAuth();
    } catch (error: any) {
      console.error("Sign in error:", error);
      throw new Error(error.message || "Đăng nhập thất bại");
    }
  };

  const signUp = async (email: string, password: string, name?: string) => {
    try {
      await cognitoSignUp(email, password, { name });
      console.log("Sign up success");
    } catch (error: any) {
      console.error("Sign up error:", error);
      throw new Error(error.message || "Đăng ký thất bại");
    }
  };

  const confirmSignUp = async (email: string, code: string) => {
    try {
      await cognitoConfirmSignUp(email, code);
      console.log("Confirm sign up success");
    } catch (error: any) {
      console.error("Confirm sign up error:", error);
      throw new Error(error.message || "Xác nhận thất bại");
    }
  };

  const signOut = () => {
    cognitoSignOut();
    setUser(null);
  };

  const signInWithGoogle = () => {
    const googleAuthUrl = getGoogleAuthUrl();
    window.location.href = googleAuthUrl;
  };

  const value: AuthContextType = {
    user,
    loading,
    signIn,
    signUp,
    confirmSignUp,
    signOut,
    signInWithGoogle,
    isAuthenticated: !!user,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return context;
};
