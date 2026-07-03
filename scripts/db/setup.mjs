import fs from "node:fs/promises";
import path from "node:path";
import { countTables, createConnection, databaseExists, getDatabaseConfig, readSql } from "./common.mjs";

const config = getDatabaseConfig({ includeDatabase: false });
let connection;

try {
  connection = await createConnection({
    includeDatabase: false,
    multipleStatements: true,
  });

  const existedBefore = await databaseExists(connection, config.databaseName);
  const tableCountBefore = existedBefore ? await countTables(connection, config.databaseName) : 0;
  const needsMigration = tableCountBefore > 0;

  console.log(`Using MySQL at ${config.host}:${config.port}`);
  console.log(`Database: ${config.databaseName}`);
  console.log(tableCountBefore > 0 ? `Existing tables: ${tableCountBefore}` : "Fresh database setup");

  await connection.query(await readSql("database/schema.sql"));
  console.log("schema.sql completed");

  if (needsMigration) {
    const migrationDir = path.join(process.cwd(), "database", "migrations");
    const migrationFiles = (await fs.readdir(migrationDir))
      .filter((file) => file.endsWith(".sql"))
      .sort();

    for (const migrationFile of migrationFiles) {
      await connection.query(await readSql(path.join("database", "migrations", migrationFile)));
      console.log(`migration completed: ${migrationFile}`);
    }
  }

  await connection.query(await readSql("database/seed.sql"));
  console.log("seed.sql completed");

  const tableCountAfter = await countTables(connection, config.databaseName);
  console.log(`database ready with ${tableCountAfter} tables`);
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);

  console.error("Cannot setup database.");
  console.error("Please start MySQL in XAMPP and verify DATABASE_URL in .env.local.");
  console.error(`Detail: ${message}`);
  process.exitCode = 1;
} finally {
  await connection?.end();
}
