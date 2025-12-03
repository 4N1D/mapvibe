import { getDb } from '../../services/db';

export interface CognitoTriggerEvent {
  version: string;
  triggerSource: string;
  region: string;
  userPoolId: string;
  userName: string;
  callerContext: {
    awsSdkVersion: string;
    clientId: string;
  };
  request: {
    userAttributes: {
      sub: string;
      email: string;
      email_verified?: string;
      name?: string;
      preferred_username?: string;
      picture?: string;
      identities?: string;
      [key: string]: string | undefined;
    };
    groupConfiguration?: object;
  };
  response: object;
}

export async function handleCognitoTrigger(
  event: CognitoTriggerEvent
): Promise<CognitoTriggerEvent> {
  const { triggerSource, request } = event;
  const { userAttributes } = request;

  console.log(`[Cognito] Trigger: ${triggerSource}`);
  console.log(`[Cognito] User: ${userAttributes.email} (${userAttributes.sub})`);

  try {
    switch (triggerSource) {
      case 'PostConfirmation_ConfirmSignUp':
        await createUserRecord(userAttributes);
        break;

      case 'PostAuthentication_Authentication':
        if (userAttributes.identities) {
          await createUserRecordIfNotExists(userAttributes);
        }
        break;

      case 'TokenGeneration_HostedAuth':
      case 'TokenGeneration_Authentication':
        await createUserRecordIfNotExists(userAttributes);
        break;

      default:
        console.log(`[Cognito] Unhandled trigger: ${triggerSource}`);
    }
  } catch (err) {
    console.error('[Cognito] Error syncing user:', err);
  }

  return event;
}

async function createUserRecord(
  userAttributes: CognitoTriggerEvent['request']['userAttributes']
): Promise<void> {
  const db = await getDb();

  const userId = userAttributes.sub;
  const email = userAttributes.email;
  const displayName =
    userAttributes.name ||
    userAttributes.preferred_username ||
    email.split('@')[0];
  const avatar = userAttributes.picture || null;
  const emailVerified = userAttributes.email_verified === 'true';

  console.log(`[Cognito] Creating user: ${email} (${userId})`);

  const existingUser = await db
    .selectFrom('users')
    .select('id')
    .where('id', '=', userId)
    .executeTakeFirst();

  if (existingUser) {
    console.log(`[Cognito] User already exists: ${userId}`);
    return;
  }

  await db
    .insertInto('users')
    .values({
      id: userId,
      email,
      display_name: displayName,
      avatar,
      email_verified: emailVerified,
      account_status: 'active',
      roles: JSON.stringify(['user']),
      reputation: 0,
      created_at: new Date(),
      updated_at: new Date(),
    })
    .execute();

  console.log(`[Cognito] User created: ${userId}`);
}

async function createUserRecordIfNotExists(
  userAttributes: CognitoTriggerEvent['request']['userAttributes']
): Promise<void> {
  const db = await getDb();

  const userId = userAttributes.sub;

  const existingUser = await db
    .selectFrom('users')
    .select('id')
    .where('id', '=', userId)
    .executeTakeFirst();

  if (!existingUser) {
    await createUserRecord(userAttributes);
    return;
  }

  await db
    .updateTable('users')
    .set({ last_login_at: new Date(), updated_at: new Date() })
    .where('id', '=', userId)
    .execute();

  console.log(`[Cognito] User exists, updated last_login: ${userId}`);
}
