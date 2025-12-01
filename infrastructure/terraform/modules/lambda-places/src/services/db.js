const { SecretsManagerClient, GetSecretValueCommand } = require('@aws-sdk/client-secrets-manager');
const { Kysely, PostgresDialect } = require('kysely');
const { Pool } = require('pg');

const secretsClient = new SecretsManagerClient();

let db = null;
let credentials = null;

async function getCredentials() {
  if (credentials) return credentials;
  
  const command = new GetSecretValueCommand({
    SecretId: process.env.DB_SECRET_ARN
  });
  
  const response = await secretsClient.send(command);
  credentials = JSON.parse(response.SecretString);
  return credentials;
}

async function getDb() {
  if (db) return db;
  
  const creds = await getCredentials();
  
  db = new Kysely({
    dialect: new PostgresDialect({
      pool: new Pool({
        host: process.env.DB_HOST,
        port: creds.port || 5432,
        database: process.env.DB_NAME,
        user: creds.username,
        password: creds.password,
        ssl: { rejectUnauthorized: false },
        max: 1,
      }),
    }),
  });
  
  return db;
}

module.exports = { getDb };
