import { Kysely, PostgresDialect } from "kysely";
import { Pool } from "pg";

// Check if running on AWS Lambda
const isLambda = !!process.env.AWS_LAMBDA_FUNCTION_NAME;

// Database instance (singleton)
let db: Kysely<any> | null = null;

interface DBCredentials {
  host: string;
  port: number;
  database: string;
  user: string;
  password: string;
}

async function getCredentials(): Promise<DBCredentials> {
  if (isLambda && process.env.DB_SECRET_ARN) {
    // AWS Lambda: Get credentials from Secrets Manager
    const { SecretsManagerClient, GetSecretValueCommand } = await import(
      "@aws-sdk/client-secrets-manager"
    );
    const client = new SecretsManagerClient({});
    const response = await client.send(
      new GetSecretValueCommand({ SecretId: process.env.DB_SECRET_ARN })
    );
    const secret = JSON.parse(response.SecretString || "{}");

    return {
      host: process.env.DB_HOST || secret.host,
      port: secret.port || 5432,
      database: process.env.DB_NAME || secret.dbname,
      user: secret.username,
      password: secret.password,
    };
  }

  // Local development: Get credentials from environment variables
  return {
    host: process.env.DB_HOST || "localhost",
    port: parseInt(process.env.DB_PORT || "5432"),
    database: process.env.DB_NAME || "mapvibe",
    user: process.env.DB_USER || "postgres",
    password: process.env.DB_PASSWORD || "",
  };
}

export async function getDb(): Promise<Kysely<any>> {
  if (db) return db;

  const creds = await getCredentials();

  console.log(
    `[DB] Connecting to ${creds.host}/${creds.database} (${isLambda ? "Lambda" : "Local"})`
  );

  db = new Kysely({
    dialect: new PostgresDialect({
      pool: new Pool({
        host: creds.host,
        port: creds.port,
        database: creds.database,
        user: creds.user,
        password: creds.password,
        ssl: { rejectUnauthorized: false },
        max: isLambda ? 1 : 10,
      }),
    }),
  });

  return db;
}

export async function closeDb(): Promise<void> {
  if (db) {
    await db.destroy();
    db = null;
  }
}

export { isLambda };
