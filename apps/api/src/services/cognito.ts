import {
  CognitoIdentityProviderClient,
  AdminSetUserPasswordCommand,
  AdminGetUserCommand,
} from "@aws-sdk/client-cognito-identity-provider";

let cognitoClient: CognitoIdentityProviderClient | null = null;

export function getCognitoClient(): CognitoIdentityProviderClient {
  if (cognitoClient) return cognitoClient;

  cognitoClient = new CognitoIdentityProviderClient({
    region: process.env.AWS_REGION || "us-east-1",
  });

  return cognitoClient;
}

const USER_POOL_ID = process.env.COGNITO_USER_POOL_ID || "";

/**
 * Set password for a user (used for OAuth users who don't have a password)
 */
export async function adminSetUserPassword(
  username: string,
  password: string,
  permanent: boolean = true
): Promise<void> {
  const client = getCognitoClient();

  const command = new AdminSetUserPasswordCommand({
    UserPoolId: USER_POOL_ID,
    Username: username,
    Password: password,
    Permanent: permanent,
  });

  await client.send(command);
}

/**
 * Check if user is an OAuth user (has external identity provider)
 */
export async function isOAuthUser(username: string): Promise<boolean> {
  const client = getCognitoClient();

  try {
    const command = new AdminGetUserCommand({
      UserPoolId: USER_POOL_ID,
      Username: username,
    });

    const response = await client.send(command);

    // Check if user has external identity linked (Google, Facebook, etc.)
    // OAuth users have UserAttributes with "identities" containing provider info
    const identitiesAttr = response.UserAttributes?.find(
      (attr: { Name?: string; Value?: string }) => attr.Name === "identities"
    );

    if (identitiesAttr?.Value) {
      const identities = JSON.parse(identitiesAttr.Value);
      return Array.isArray(identities) && identities.length > 0;
    }

    return false;
  } catch (error) {
    console.error("[Cognito] Error checking OAuth user:", error);
    return false;
  }
}
