import {
  AuthenticationDetails,
  CognitoUser,
  CognitoUserAttribute,
  CognitoUserPool,
} from "amazon-cognito-identity-js";

const poolData = {
  UserPoolId: import.meta.env.VITE_COGNITO_USER_POOL_ID,
  ClientId: import.meta.env.VITE_COGNITO_APP_CLIENT_ID,
};

export const userPool = new CognitoUserPool(poolData);

export const signUp = (
  email: string,
  password: string,
  attributes: { name?: string } = {}
): Promise<{ user: CognitoUser; userConfirmed: boolean }> => {
  return new Promise((resolve, reject) => {
    const attributeList: CognitoUserAttribute[] = [];

    attributeList.push(
      new CognitoUserAttribute({
        Name: "email",
        Value: email,
      })
    );

    if (attributes.name) {
      attributeList.push(
        new CognitoUserAttribute({
          Name: "name",
          Value: attributes.name,
        })
      );
    }

    userPool.signUp(email, password, attributeList, [], (err, result) => {
      if (err) {
        reject(err);
        return;
      }
      if (!result) {
        reject(new Error("Sign up failed"));
        return;
      }
      resolve({
        user: result.user,
        userConfirmed: result.userConfirmed,
      });
    });
  });
};

export const signIn = (
  email: string,
  password: string
): Promise<{
  accessToken: string;
  idToken: string;
  refreshToken: string;
}> => {
  return new Promise((resolve, reject) => {
    const authenticationDetails = new AuthenticationDetails({
      Username: email,
      Password: password,
    });

    const cognitoUser = new CognitoUser({
      Username: email,
      Pool: userPool,
    });

    cognitoUser.authenticateUser(authenticationDetails, {
      onSuccess: (result) => {
        resolve({
          accessToken: result.getAccessToken().getJwtToken(),
          idToken: result.getIdToken().getJwtToken(),
          refreshToken: result.getRefreshToken().getToken(),
        });
      },
      onFailure: (err) => {
        reject(err);
      },
    });
  });
};

export const signOut = (): void => {
  const cognitoUser = userPool.getCurrentUser();
  if (cognitoUser) {
    cognitoUser.signOut();
  }
};

export const getCurrentUser = (): Promise<CognitoUser | null> => {
  return new Promise((resolve) => {
    const cognitoUser = userPool.getCurrentUser();
    if (!cognitoUser) {
      resolve(null);
      return;
    }

    cognitoUser.getSession((err: Error | null, session: any) => {
      if (err || !session.isValid()) {
        resolve(null);
        return;
      }
      resolve(cognitoUser);
    });
  });
};

export const getTokens = (): Promise<{
  accessToken: string;
  idToken: string;
} | null> => {
  return new Promise((resolve) => {
    const cognitoUser = userPool.getCurrentUser();
    if (!cognitoUser) {
      resolve(null);
      return;
    }

    cognitoUser.getSession((err: Error | null, session: any) => {
      if (err || !session.isValid()) {
        resolve(null);
        return;
      }
      resolve({
        accessToken: session.getAccessToken().getJwtToken(),
        idToken: session.getIdToken().getJwtToken(),
      });
    });
  });
};

export const getUserAttributes = (): Promise<Record<string, string> | null> => {
  return new Promise((resolve) => {
    const cognitoUser = userPool.getCurrentUser();
    if (!cognitoUser) {
      resolve(null);
      return;
    }

    cognitoUser.getSession((err: Error | null, session: any) => {
      if (err || !session.isValid()) {
        resolve(null);
        return;
      }

      cognitoUser.getUserAttributes((err, attributes) => {
        if (err || !attributes) {
          resolve(null);
          return;
        }

        const attrs: Record<string, string> = {};
        attributes.forEach((attr) => {
          attrs[attr.Name] = attr.Value;
        });
        resolve(attrs);
      });
    });
  });
};

export const getGoogleAuthUrl = (
  redirectUri: string = `${window.location.origin}/auth/callback`
): string => {
  const domain = import.meta.env.VITE_COGNITO_DOMAIN;
  const clientId = import.meta.env.VITE_COGNITO_APP_CLIENT_ID;

  const params = new URLSearchParams({
    identity_provider: "Google",
    redirect_uri: redirectUri,
    response_type: "code",
    client_id: clientId,
    scope: "openid email profile",
  });

  return `https://${domain}/oauth2/authorize?${params.toString()}`;
};

export const confirmSignUp = (email: string, code: string): Promise<string> => {
  return new Promise((resolve, reject) => {
    const cognitoUser = new CognitoUser({
      Username: email,
      Pool: userPool,
    });

    cognitoUser.confirmRegistration(code, true, (err, result) => {
      if (err) {
        reject(err);
        return;
      }
      resolve(result);
    });
  });
};
