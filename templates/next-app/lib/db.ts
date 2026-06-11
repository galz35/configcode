import * as sql from 'mssql';
import { Pool } from 'pg';

// Configuración de base de datos para SQL Server
const dbConfig: sql.config = {
  user: process.env.DB_USER || 'sa',
  password: process.env.DB_PASSWORD || 'Password123',
  server: process.env.DB_HOST || 'localhost',
  database: process.env.DB_NAME || 'MiBaseDatos',
  port: parseInt(process.env.DB_PORT || '1433'),
  options: {
    encrypt: process.env.NODE_ENV === 'production',
    trustServerCertificate: true, // Para desarrollo local
  },
  pool: {
    max: 10,
    min: 2,
    idleTimeoutMillis: 30000,
  },
};

// Pool singleton de SQL Server
let mssqlPool: sql.ConnectionPool | null = null;

export async function getMssqlPool(): Promise<sql.ConnectionPool> {
  if (mssqlPool) return mssqlPool;
  mssqlPool = new sql.ConnectionPool(dbConfig);
  await mssqlPool.connect();
  return mssqlPool;
}

// Ejecuta consultas parametrizadas directas en SQL Server (mssql)
export async function queryMssql<T = any>(
  queryText: string,
  params: { name: string; type: sql.ISqlType; value: any }[] = []
): Promise<T[]> {
  const pool = await getMssqlPool();
  const request = pool.request();
  for (const p of params) {
    request.input(p.name, p.type, p.value);
  }
  const result = await request.query(queryText);
  return result.recordset as T[];
}

export async function queryOneMssql<T = any>(
  queryText: string,
  params: { name: string; type: sql.ISqlType; value: any }[] = []
): Promise<T | null> {
  const records = await queryMssql<T>(queryText, params);
  return records.length > 0 ? records[0] : null;
}

// ----------------------------------------------------
// Opcional: Pool singleton de PostgreSQL
// ----------------------------------------------------
let pgPool: Pool | null = null;

export function getPgPool(): Pool {
  if (pgPool) return pgPool;
  pgPool = new Pool({
    connectionString: process.env.DATABASE_URL,
    max: 10,
    idleTimeoutMillis: 30000,
  });
  return pgPool;
}

export async function queryPg<T = any>(sql: string, params?: any[]): Promise<T[]> {
  const pool = getPgPool();
  const result = await pool.query(sql, params);
  return result.rows as T[];
}

export async function queryOnePg<T = any>(sql: string, params?: any[]): Promise<T | null> {
  const records = await queryPg<T>(sql, params);
  return records.length > 0 ? records[0] : null;
}
