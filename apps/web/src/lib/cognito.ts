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
          ],
          redirectSignOut: [
            "http://localhost:5173",
            "https://mapvibe.site",
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

export const signOut = async (): Promise<void> => {
  await amplifySignOut({ global: true });
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

      return {
        sub: payload.sub as string,
        email: (payload.email as string) || "",
        name: (payload.name as string) || (payload.email as string) || "",
        email_verified: (payload.email_verified as string) || "false",
      };
    }

    // Fallback for users without ID token
    const attributes = await fetchUserAttributes();
    return attributes as Record<string, string>;
  } catch (error: any) {
    console.error("[Cognito] Failed to get user attributes:", error.message);
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
export const changePassword = async (
  oldPassword: string,
  newPassword: string
): Promise<void> => {
  await updatePassword({
    oldPassword,
    newPassword,
  });
};
