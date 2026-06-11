import { Pool as PgPool } from "pg";
import sql from "mssql";
import pino from "pino";

const logger = pino();

// 1. PostgreSQL Connection Pool Setup
export const pgPool = new PgPool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === "production" ? { rejectUnauthorized: false } : false
});

// Helper for PostgreSQL parameterized queries
export async function queryPg(text: string, params?: any[]) {
  const start = Date.now();
  try {
    const res = await pgPool.query(text, params);
    const duration = Date.now() - start;
    logger.info({ text, duration, rows: res.rowCount }, "Executed PG Query");
    return res;
  } catch (err) {
    logger.error({ text, err }, "PG Query Failed");
    throw err;
  }
}

// 2. SQL Server Connection Setup
const mssqlConfig: sql.config = {
  user: process.env.DB_USER || "sa",
  password: process.env.DB_PASSWORD || "YourPassword123!",
  server: process.env.DB_SERVER || "localhost",
  database: process.env.DB_NAME || "master",
  options: {
    encrypt: true, // Use true for azure, false for local
    trustServerCertificate: true // Use true for local dev
  }
};

export const mssqlPool = new sql.ConnectionPool(mssqlConfig);
export const mssqlConnectPromise = mssqlPool.connect()
  .then(pool => {
    logger.info("Connected to SQL Server");
    return pool;
  })
  .catch(err => {
    logger.error({ err }, "SQL Server Connection Failed");
  });

// Helper for SQL Server parameterized queries
export async function queryMssql(text: string, inputs: { name: string; type: any; value: any }[]) {
  const start = Date.now();
  try {
    await mssqlConnectPromise;
    const request = mssqlPool.request();
    for (const input of inputs) {
      request.input(input.name, input.type, input.value);
    }
    const result = await request.query(text);
    const duration = Date.now() - start;
    logger.info({ text, duration }, "Executed MSSQL Query");
    return result;
  } catch (err) {
    logger.error({ text, err }, "MSSQL Query Failed");
    throw err;
  }
}
