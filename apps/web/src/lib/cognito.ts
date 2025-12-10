import { Amplify } from "aws-amplify";
import {
  signIn as amplifySignIn,
  signUp as amplifySignUp,
  confirmSignUp as amplifyConfirmSignUp,
  signOut as amplifySignOut,
  getCurrentUser as amplifyGetCurrentUser,
  fetchUserAttributes,
  signInWithRedirect,
  fetchAuthSession,
  updatePassword,
  resetPassword as amplifyResetPassword,
  confirmResetPassword as amplifyConfirmResetPassword,
} from "aws-amplify/auth";

Amplify.configure({
  Auth: {
    Cognito: {
      userPoolId: import.meta.env.VITE_COGNITO_USER_POOL_ID,
      userPoolClientId: import.meta.env.VITE_COGNITO_APP_CLIENT_ID,
      loginWith: {
        oauth: {
          domain: import.meta.env.VITE_COGNITO_DOMAIN,
          scopes: ["openid", "email", "profile", "aws.cognito.signin.user.admin"],
          redirectSignIn: [
            "http://localhost:5173/auth/callback",
            "https://d1oasw0quh6m55.cloudfront.net/auth/callback",
            "https://mapvibe.site/auth/callback",
            "http://localhost:5174/auth/callback",
          ],
          redirectSignOut: [
            "http://localhost:5173",
            "https://d1oasw0quh6m55.cloudfront.net",
            "https://mapvibe.site",
            "http://localhost:5174",
          ],
          responseType: "code",
        },
      },
    },
  },
});

// Sign up với email và password
export const signUp = async (
  email: string,
  password: string,
  attributes: { name?: string } = {}
): Promise<{ userConfirmed: boolean }> => {
  const result = await amplifySignUp({
    username: email,
    password,
    options: {
      userAttributes: {
        email,
        ...(attributes.name && { name: attributes.name }),
      },
    },
  });

  return {
    userConfirmed: result.isSignUpComplete,
  };
};

export const confirmSignUp = async (email: string, code: string): Promise<void> => {
  await amplifyConfirmSignUp({
    username: email,
    confirmationCode: code,
  });
};

// Sign in với email và password
export const signIn = async (email: string, password: string): Promise<void> => {
  await amplifySignIn({
    username: email,
    password,
  });
};

/**
 * Sign out user - handles both OAuth and email/password users
 * Uses global: true to sign out from all devices
 */
export const signOut = async (): Promise<void> => {
  try {
    // First try global signOut (signs out from all devices)
    await amplifySignOut({ global: true });
  } catch (error) {
    console.warn("[Cognito] Global signOut failed, trying local signOut:", error);
    try {
      // Fallback to local signOut if global fails
      await amplifySignOut();
    } catch (localError) {
      console.error("[Cognito] Local signOut also failed:", localError);
      // Force clear local state even if API call fails
      // This ensures user is logged out on client side
      throw localError;
    }
  }
};

export const getCurrentUser = async (): Promise<any> => {
  try {
    const user = await amplifyGetCurrentUser();
    return user;
  } catch {
    return null;
  }
};

/**
 * Get user attributes from ID token (works for both OAuth and email/password users)
 */
export const getUserAttributes = async (): Promise<Record<string, string> | null> => {
  try {
    const session = await fetchAuthSession();

    if (session.tokens?.idToken) {
      const payload = session.tokens.idToken.payload;

      // Check if user logged in via OAuth (Google, etc.)
      // OAuth users have 'identities' in their token
      const identities = payload.identities as Array<{ providerName: string }> | undefined;
      const isOAuthUser = identities && identities.length > 0;

      return {
        sub: payload.sub as string,
        email: (payload.email as string) || "",
        name: (payload.name as string) || (payload.email as string) || "",
        email_verified: (payload.email_verified as string) || "false",
        isOAuthUser: isOAuthUser ? "true" : "false",
      };
    }

    // Fallback for users without ID token
    const attributes = await fetchUserAttributes();
    return attributes as Record<string, string>;
  } catch (error: unknown) {
    const err = error as { message?: string };
    console.error("[Cognito] Failed to get user attributes:", err.message);
    return null;
  }
};

/**
 * Sign in with Google OAuth
 */
export const signInWithGoogle = async (): Promise<void> => {
  await signInWithRedirect({
    provider: "Google",
  });
};

/**
 * Change password for authenticated user
 */
export const changePassword = async (oldPassword: string, newPassword: string): Promise<void> => {
  await updatePassword({
    oldPassword,
    newPassword,
  });
};

/**
 * Request password reset - sends verification code to email
 * Returns the next step info from Cognito
 */
export const forgotPassword = async (
  email: string
): Promise<{ nextStep: string; codeDeliveryDetails?: unknown }> => {
  const result = await amplifyResetPassword({
    username: email,
  });
  console.log("[Cognito] Reset password result:", result);
  return {
    nextStep: result.nextStep.resetPasswordStep,
    codeDeliveryDetails: result.nextStep.codeDeliveryDetails,
  };
};

/**
 * Confirm password reset with verification code and new password
 */
export const confirmForgotPassword = async (
  email: string,
  code: string,
  newPassword: string
): Promise<void> => {
  await amplifyConfirmResetPassword({
    username: email,
    confirmationCode: code,
    newPassword,
  });
};
