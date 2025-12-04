/* eslint-disable @typescript-eslint/no-require-imports */
const { Pool } = require("pg");

let pool = null;

async function getPool() {
  if (pool) return pool;

  const dbConfig = {
    host: process.env.DB_HOST,
    port: parseInt(process.env.DB_PORT || "5432"),
    database: process.env.DB_NAME,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    ssl: { rejectUnauthorized: false },
    max: 1,
  };

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

exports.handler = async (event) => {
  console.log("[S3 Trigger] Event:", JSON.stringify(event, null, 2));

  const db = await getPool();

  for (const record of event.Records) {
    const bucket = record.s3.bucket.name;
    const s3Key = decodeURIComponent(record.s3.object.key.replace(/\+/g, " "));
    const eventName = record.eventName;

    console.log(`[S3 Trigger] ${eventName}: s3://${bucket}/${s3Key}`);

    const cdnDomain = process.env.CLOUDFRONT_DOMAIN;
    const cdnUrl = cdnDomain
      ? `https://${cdnDomain}/${s3Key}`
      : `https://${bucket}.s3.${process.env.AWS_REGION}.amazonaws.com/${s3Key}`;

    const result = await db.query(
      "UPDATE photos SET processed_at = true WHERE s3_url = $1 RETURNING id",
      [cdnUrl]
    );

    if (result.rowCount > 0) {
      console.log(`[S3 Trigger] Updated photo: ${result.rows[0].id}`);
    } else {
      console.log(`[S3 Trigger] No photo record found for: ${cdnUrl}`);
    }
  }

  return { statusCode: 200, body: "OK" };
};
