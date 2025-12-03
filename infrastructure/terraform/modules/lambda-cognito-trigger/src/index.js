const { Pool } = require("pg");

let pool = null;

async function getPool() {
  if (pool) return pool;

  // Get credentials from environment or Secrets Manager
  let dbConfig = {
    host: process.env.DB_HOST,
    port: parseInt(process.env.DB_PORT || "5432"),
    database: process.env.DB_NAME,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    ssl: { rejectUnauthorized: false },
    max: 1,
  };

  // If using Secrets Manager
  if (process.env.DB_SECRET_ARN) {
    const {
      SecretsManagerClient,
      GetSecretValueCommand,
    } = require("@aws-sdk/client-secrets-manager");
    const client = new SecretsManagerClient({});
    const response = await client.send(
      new GetSecretValueCommand({ SecretId: process.env.DB_SECRET_ARN })
    );
    const secret = JSON.parse(response.SecretString);
    dbConfig.user = secret.username;
    dbConfig.password = secret.password;
  }

  pool = new Pool(dbConfig);
  return pool;
}

exports.handler = async (event, context) => {
  console.log("Cognito Trigger Event:", JSON.stringify(event, null, 2));

  const triggerSource = event.triggerSource;
  const userAttributes = event.request.userAttributes;

  try {
    // Handle different trigger types
    switch (triggerSource) {
      // Email/password signup - after user confirms email
      case "PostConfirmation_ConfirmSignUp":
        await createUserRecord(userAttributes);
        break;

      // Google OAuth - first time login
      case "PostAuthentication_Authentication":
        // Only for federated (Google) users
        if (userAttributes.identities) {
          await createUserRecordIfNotExists(userAttributes);
        }
        break;

      // Pre Token Generation - can also sync user here for OAuth
      case "TokenGeneration_HostedAuth":
      case "TokenGeneration_Authentication":
        await createUserRecordIfNotExists(userAttributes);
        break;

      default:
        console.log(`Unhandled trigger: ${triggerSource}`);
    }

    // Return event to Cognito
    return event;
  } catch (error) {
    console.error("Error in Cognito trigger:", error);
    // Don't throw - let user continue even if DB sync fails
    // We can retry later or sync on next login
    return event;
  }
};

async function createUserRecord(userAttributes) {
  const db = await getPool();

  const userId = userAttributes.sub;
  const email = userAttributes.email;
  const displayName =
    userAttributes.name || userAttributes.preferred_username || email.split("@")[0];
  const avatar = userAttributes.picture || null;
  const emailVerified = userAttributes.email_verified === "true";

  console.log(`Creating user record for: ${email} (${userId})`);

  const query = `
    INSERT INTO users (id, email, display_name, avatar, email_verified, account_status, roles, reputation, created_at, updated_at)
    VALUES ($1, $2, $3, $4, $5, 'active', '["user"]'::json, 0, NOW(), NOW())
    ON CONFLICT (id) DO NOTHING
    RETURNING id
  `;

  const result = await db.query(query, [userId, email, displayName, avatar, emailVerified]);

  if (result.rowCount > 0) {
    console.log(`User created: ${userId}`);
  } else {
    console.log(`User already exists: ${userId}`);
  }

  return result;
}

async function createUserRecordIfNotExists(userAttributes) {
  const db = await getPool();

  const userId = userAttributes.sub;
  const email = userAttributes.email;

  // Check if user exists
  const checkResult = await db.query("SELECT id FROM users WHERE id = $1", [userId]);

  if (checkResult.rows.length === 0) {
    // User doesn't exist, create it
    return await createUserRecord(userAttributes);
  }

  // Update last_login_at
  await db.query("UPDATE users SET last_login_at = NOW() WHERE id = $1", [userId]);

  console.log(`User exists, updated last_login: ${userId}`);
}
