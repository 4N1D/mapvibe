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
    groupConfiguration?: {
      groupsToOverride?: string[];
      iamRolesToOverride?: string[];
      preferredRole?: string;
    };
  };
  response: {
    claimsOverrideDetails?: {
      claimsToAddOrOverride?: Record<string, string>;
      claimsToSuppress?: string[];
      groupOverrideDetails?: {
        groupsToOverride?: string[];
        iamRolesToOverride?: string[];
        preferredRole?: string;
      };
    };
  };
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
      // 1. Post Confirmation - Tạo user khi đăng ký email
      case 'PostConfirmation_ConfirmSignUp':
        await createUserRecord(userAttributes);
        break;

      // 2. Post Authentication - Update last_login mỗi lần đăng nhập
      case 'PostAuthentication_Authentication':
        await handlePostAuthentication(userAttributes);
        break;

      // 3. Pre Token Generation V1 - Sync user + thêm roles vào token
      case 'TokenGeneration_HostedAuth':
      case 'TokenGeneration_Authentication':
      case 'TokenGeneration_RefreshTokens':
        event = await handlePreTokenGeneration(event);
        break;

      default:
        console.log(`[Cognito] Unhandled trigger: ${triggerSource}`);
    }
  } catch (err) {
    console.error('[Cognito] Error in trigger:', err);
  }

  return event;
}

async function handlePostAuthentication(
  userAttributes: CognitoTriggerEvent['request']['userAttributes']
): Promise<void> {
  const db = await getDb();
  const userId = userAttributes.sub;

  // Kiểm tra và tạo user nếu chưa có (OAuth users)
  if (userAttributes.identities) {
    await createUserRecordIfNotExists(userAttributes);
  }

  // Update last_login
  await db
    .updateTable('users')
    .set({ last_login_at: new Date(), updated_at: new Date() })
    .where('id', '=', userId)
    .execute();

  console.log(`[Cognito] PostAuth: Updated last_login for ${userId}`);
}

async function handlePreTokenGeneration(
  event: CognitoTriggerEvent
): Promise<CognitoTriggerEvent> {
  const { userAttributes } = event.request;
  const userId = userAttributes.sub;

  // 1. Đảm bảo user tồn tại trong DB
  await createUserRecordIfNotExists(userAttributes);

  // 2. Lấy roles từ DB
  const db = await getDb();
  const dbUser = await db
    .selectFrom('users')
    .select(['roles'])
    .where('id', '=', userId)
    .executeTakeFirst();

  const roles = dbUser?.roles ? JSON.parse(dbUser.roles as string) : ['user'];

  // 3. Thêm custom claims vào token
  event.response = {
    claimsOverrideDetails: {
      claimsToAddOrOverride: {
        'custom:roles': JSON.stringify(roles),
      },
    },
  };

  console.log(`[Cognito] PreToken: Added roles claim for ${userId}: ${roles}`);

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
