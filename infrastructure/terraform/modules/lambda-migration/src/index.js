const { SecretsManagerClient, GetSecretValueCommand } = require('@aws-sdk/client-secrets-manager');
const { Kysely, PostgresDialect, Migrator, FileMigrationProvider } = require('kysely');
const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

const secretsClient = new SecretsManagerClient();

async function getDbCredentials() {
  const command = new GetSecretValueCommand({
    SecretId: process.env.DB_SECRET_ARN
  });
  
  const response = await secretsClient.send(command);
  return JSON.parse(response.SecretString);
}

async function createKyselyInstance(credentials) {
  return new Kysely({
    dialect: new PostgresDialect({
      pool: new Pool({
        host: process.env.DB_HOST,
        port: credentials.port || 5432,
        database: process.env.DB_NAME,
        user: credentials.username,
        password: credentials.password,
        ssl: { rejectUnauthorized: false },
        max: 1,
      }),
    }),
  });
}

// Query mode - run raw SQL
async function handleQuery(db, sql) {
  console.log('Executing query:', sql);
  const result = await db.executeQuery({
    sql,
    parameters: [],
  });
  return {
    statusCode: 200,
    body: JSON.stringify({
      message: 'Query executed',
      rowCount: result.rows.length,
      rows: result.rows,
    }),
  };
}

// Migration mode - run Kysely migrations
async function handleMigration(db, shouldRollback) {
  const migrator = new Migrator({
    db,
    provider: new FileMigrationProvider({
      fs: require('fs/promises'),
      path,
      migrationFolder: path.join(__dirname, 'migrations'),
    }),
  });

  let results;
  let error;

  if (shouldRollback) {
    console.log('Rolling back last migration...');
    ({ error, results } = await migrator.migrateDown());
  } else {
    console.log('Running migrations to latest...');
    ({ error, results } = await migrator.migrateToLatest());
  }

  const migrationResults = [];
  results?.forEach((it) => {
    if (it.status === 'Success') {
      console.log(`✅ Migration "${it.migrationName}" executed successfully`);
      migrationResults.push({ name: it.migrationName, status: 'Success' });
    } else if (it.status === 'Error') {
      console.error(`❌ Failed to execute migration "${it.migrationName}"`);
      migrationResults.push({ name: it.migrationName, status: 'Error' });
    } else if (it.status === 'NotExecuted') {
      console.log(`⏭️ Migration "${it.migrationName}" was not executed (already applied)`);
      migrationResults.push({ name: it.migrationName, status: 'NotExecuted' });
    }
  });

  if (error) throw error;

  return {
    statusCode: 200,
    body: JSON.stringify({
      message: shouldRollback ? 'Rollback completed' : 'Migrations completed successfully',
      results: migrationResults,
    }),
  };
}

exports.handler = async (event) => {
  console.log('Lambda invoked with event:', JSON.stringify(event));

  let db;

  try {
    const credentials = await getDbCredentials();
    console.log(`Connecting to database: ${process.env.DB_HOST}/${process.env.DB_NAME}`);

    db = await createKyselyInstance(credentials);
    console.log('Database connected');

    // Determine action
    const action = event.action || 'migrate';

    if (action === 'query' && event.sql) {
      return await handleQuery(db, event.sql);
    } else if (action === 'migrate' || event.rollback !== undefined) {
      return await handleMigration(db, event.rollback === true);
    } else {
      return {
        statusCode: 400,
        body: JSON.stringify({
          message: 'Invalid action',
          usage: {
            migrate: '{ } or { "action": "migrate" }',
            rollback: '{ "rollback": true }',
            query: '{ "action": "query", "sql": "SELECT * FROM users LIMIT 10" }',
          },
        }),
      };
    }
  } catch (error) {
    console.error('Error:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({
        message: 'Error',
        error: error.message,
      }),
    };
  } finally {
    if (db) {
      await db.destroy();
      console.log('Database connection closed');
    }
  }
};
