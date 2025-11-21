import { promises as fs } from "fs";
import { Kysely, Migrator, PostgresDialect, FileMigrationProvider } from "kysely";
import { Pool } from "pg";
import * as path from "path";

// Bun automatically loads .env file from project root
// No need for dotenv package - Bun has built-in support

async function migrateToLatest() {
  const db = new Kysely({
    dialect: new PostgresDialect({
      pool: new Pool({
        host: process.env.DB_HOST || "localhost",
        port: parseInt(process.env.DB_PORT || "5432"),
        user: process.env.DB_USER || "postgres",
        password: process.env.DB_PASSWORD || "password",
        database: process.env.DB_NAME || "mapvibe_db",
      }),
    }),
  });

  const migrator = new Migrator({
    db,
    provider: new FileMigrationProvider({
      fs,
      path,
      migrationFolder: path.join(__dirname, "migrations"),
    }),
  });

  const { error, results } = await migrator.migrateToLatest();

  results?.forEach((it) => {
    if (it.status === "Success") {
      console.log(`Migration "${it.migrationName}" was executed successfully`);
    } else if (it.status === "Error") {
      console.error(`Failed to execute migration "${it.migrationName}"`);
    }
  });

  if (error) {
    console.error("Failed to migrate");
    console.error(error);
    process.exit(1);
  }

  await db.destroy();
}

async function migrateDown(steps: number = 1) {
  const db = new Kysely({
    dialect: new PostgresDialect({
      pool: new Pool({
        host: process.env.DB_HOST || "localhost",
        port: parseInt(process.env.DB_PORT || "5432"),
        user: process.env.DB_USER || "postgres",
        password: process.env.DB_PASSWORD || "password",
        database: process.env.DB_NAME || "mapvibe_db",
      }),
    }),
  });

  const migrator = new Migrator({
    db,
    provider: new FileMigrationProvider({
      fs,
      path,
      migrationFolder: path.join(__dirname, "migrations"),
    }),
  });

  const { error, results } = await migrator.migrateDown();

  results?.forEach((it) => {
    if (it.status === "Success") {
      console.log(`Rollback "${it.migrationName}" was executed successfully`);
    } else if (it.status === "Error") {
      console.error(`Failed to rollback migration "${it.migrationName}"`);
    }
  });

  if (error) {
    console.error("Failed to rollback");
    console.error(error);
    process.exit(1);
  }

  await db.destroy();
}

const args = process.argv.slice(2);
const shouldRollback = args.includes("--down");

if (shouldRollback) {
  migrateDown();
} else {
  migrateToLatest();
}
