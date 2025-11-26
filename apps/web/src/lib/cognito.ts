import { Amplify } from "aws-amplify";
import {
  signIn as amplifySignIn,
  signUp as amplifySignUp,
  confirmSignUp as amplifyConfirmSignUp,
  signOut as amplifySignOut,
  getCurrentUser as amplifyGetCurrentUser,
  fetchUserAttributes,
  signInWithRedirect,
} from "aws-amplify/auth";

Amplify.configure({
  Auth: {
    Cognito: {
      userPoolId: import.meta.env.VITE_COGNITO_USER_POOL_ID,
      userPoolClientId: import.meta.env.VITE_COGNITO_APP_CLIENT_ID,
      loginWith: {
        oauth: {
          domain: import.meta.env.VITE_COGNITO_DOMAIN,
          scopes: ["openid", "email", "profile"],
          redirectSignIn: ["http://localhost:5173", "http://localhost:5173/"],
          redirectSignOut: ["http://localhost:5173", "http://localhost:5173/"],
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
  await amplifySignOut();
};

export const getCurrentUser = async (): Promise<any> => {
  try {
    const user = await amplifyGetCurrentUser();
    return user;
  } catch (error) {
    return null;
  }
};

export const getUserAttributes = async (): Promise<Record<string, string> | null> => {
  try {
    const attributes = await fetchUserAttributes();
    return attributes as Record<string, string>;
  } catch (error) {
    return null;
  }
};

export const signInWithGoogle = async (): Promise<void> => {
  await signInWithRedirect({
    provider: "Google",
  });
};
export const getGoogleAuthUrl = (): string => {
  const domain = import.meta.env.VITE_COGNITO_DOMAIN;
  const clientId = import.meta.env.VITE_COGNITO_APP_CLIENT_ID;
  const redirectUri = window.location.origin;

  const params = new URLSearchParams({
    identity_provider: "Google",
    redirect_uri: redirectUri,
    response_type: "code",
    client_id: clientId,
    scope: "openid email profile",
  });

  return `https://${domain}/oauth2/authorize?${params.toString()}`;
};
