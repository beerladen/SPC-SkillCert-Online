import mysql, {
  type FieldPacket,
  type Pool,
  type QueryResult,
  type RowDataPacket,
} from "mysql2/promise";

type GlobalWithPool = typeof globalThis & {
  spcSkillCertPool?: Pool;
};

export interface DatabaseHealth {
  ok: boolean;
  status: "configured" | "not_configured" | "unavailable";
  database?: string;
  host?: string;
  tableCount?: number;
  checkedAt: string;
  message: string;
}

type SqlValue =
  | string
  | number
  | bigint
  | boolean
  | Date
  | null
  | Buffer
  | Uint8Array
  | SqlValue[]
  | { [key: string]: SqlValue };

export class DatabaseConfigurationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "DatabaseConfigurationError";
  }
}

function getDatabaseUrl() {
  const databaseUrl = process.env.DATABASE_URL;

  if (!databaseUrl) {
    throw new DatabaseConfigurationError(
      "DATABASE_URL is not configured. Copy .env.example to .env.local and start MySQL in XAMPP.",
    );
  }

  return databaseUrl;
}

function parseDatabaseUrl(databaseUrl: string) {
  const url = new URL(databaseUrl);
  const database = url.pathname.replace(/^\//, "");

  if (!database) {
    throw new DatabaseConfigurationError("DATABASE_URL must include a database name.");
  }

  return {
    host: url.hostname || "localhost",
    port: Number(url.port || 3306),
    user: decodeURIComponent(url.username || "root"),
    password: decodeURIComponent(url.password || ""),
    database,
  };
}

export function getDatabaseConfig() {
  return parseDatabaseUrl(getDatabaseUrl());
}

export function getPool() {
  const globalForPool = globalThis as GlobalWithPool;

  if (!globalForPool.spcSkillCertPool) {
    const config = getDatabaseConfig();

    globalForPool.spcSkillCertPool = mysql.createPool({
      ...config,
      charset: "utf8mb4",
      connectionLimit: 10,
      dateStrings: true,
      enableKeepAlive: true,
      keepAliveInitialDelay: 0,
      namedPlaceholders: true,
      queueLimit: 0,
      timezone: "+07:00",
      waitForConnections: true,
    });
  }

  return globalForPool.spcSkillCertPool;
}

export async function queryRows<T extends RowDataPacket>(
  sql: string,
  values: SqlValue = {},
) {
  const [rows] = await getPool().execute<T[]>(sql, values);
  return rows;
}

export async function executeQuery<T extends QueryResult>(
  sql: string,
  values: SqlValue = {},
): Promise<[T, FieldPacket[]]> {
  return getPool().execute<T>(sql, values);
}

export async function getDatabaseHealth(): Promise<DatabaseHealth> {
  const checkedAt = new Date().toISOString();

  try {
    const config = getDatabaseConfig();
    const rows = await queryRows<RowDataPacket & { table_count: number }>(
      `SELECT COUNT(*) AS table_count
       FROM information_schema.tables
       WHERE table_schema = :database`,
      { database: config.database },
    );

    return {
      ok: true,
      status: "configured",
      database: config.database,
      host: `${config.host}:${config.port}`,
      tableCount: Number(rows[0]?.table_count ?? 0),
      checkedAt,
      message: "เชื่อมต่อฐานข้อมูล MySQL/XAMPP ได้",
    };
  } catch (error) {
    if (error instanceof DatabaseConfigurationError) {
      return {
        ok: false,
        status: "not_configured",
        checkedAt,
        message: error.message,
      };
    }

    return {
      ok: false,
      status: "unavailable",
      checkedAt,
      message: error instanceof Error ? error.message : "Cannot connect to database.",
    };
  }
}
