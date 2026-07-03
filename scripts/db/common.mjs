import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import dotenv from "dotenv";
import mysql from "mysql2/promise";

const projectRoot = process.cwd();

dotenv.config({ path: path.join(projectRoot, ".env.local"), quiet: true });
dotenv.config({ path: path.join(projectRoot, ".env"), quiet: true });

export function getDatabaseConfig({ includeDatabase = true } = {}) {
  const databaseUrl = process.env.DATABASE_URL;

  if (!databaseUrl) {
    throw new Error("DATABASE_URL is missing. Copy .env.example to .env.local first.");
  }

  const url = new URL(databaseUrl);
  const database = url.pathname.replace(/^\//, "");

  if (!database) {
    throw new Error("DATABASE_URL must include database name, e.g. spc_skillcert_online.");
  }

  return {
    host: url.hostname || "localhost",
    port: Number(url.port || 3306),
    user: decodeURIComponent(url.username || "root"),
    password: decodeURIComponent(url.password || ""),
    database: includeDatabase ? database : undefined,
    databaseName: database,
  };
}

export async function createConnection({ includeDatabase = true, multipleStatements = false } = {}) {
  const config = getDatabaseConfig({ includeDatabase });

  return mysql.createConnection({
    host: config.host,
    port: config.port,
    user: config.user,
    password: config.password,
    database: config.database,
    charset: "utf8mb4",
    dateStrings: true,
    multipleStatements,
    timezone: "+07:00",
  });
}

export async function readSql(relativePath) {
  return fs.readFile(path.join(projectRoot, relativePath), "utf8");
}

export async function databaseExists(connection, databaseName) {
  const [rows] = await connection.query(
    "SELECT SCHEMA_NAME FROM information_schema.SCHEMATA WHERE SCHEMA_NAME = ?",
    [databaseName],
  );

  return rows.length > 0;
}

export async function countTables(connection, databaseName) {
  const [rows] = await connection.query(
    `SELECT COUNT(*) AS table_count
     FROM information_schema.tables
     WHERE table_schema = ?`,
    [databaseName],
  );

  return Number(rows[0]?.table_count ?? 0);
}
