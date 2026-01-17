/**
 * PostgreSQL Database Connection Module
 * Provides connection pooling, query helpers, and transaction support
 * for the myid_africa database
 */

import pg from 'pg';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

// Load environment from .env file
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
dotenv.config({ path: join(__dirname, '..', '.env') });

const { Pool } = pg;

// Database configuration from environment variables
// Use Unix socket by default (set DB_HOST to override for TCP connection)
const dbConfig = {
  database: process.env.DB_NAME || 'myid_africa',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || '',
  // Connection pool settings
  max: parseInt(process.env.DB_POOL_SIZE || '20', 10),
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000,
};

// Use TCP host if DB_HOST is explicitly set, otherwise use Unix socket
const dbHost = process.env.DB_HOST;
console.log('Database config - DB_HOST:', dbHost);

if (dbHost && dbHost !== '' && dbHost !== 'socket') {
  dbConfig.host = dbHost;
  dbConfig.port = parseInt(process.env.DB_PORT || '5432', 10);
  console.log('Database: Using TCP connection to', dbConfig.host, ':', dbConfig.port);
} else {
  // Use Unix socket (default for local PostgreSQL)
  dbConfig.host = '/var/run/postgresql';
  console.log('Database: Using Unix socket at', dbConfig.host);
}

// Enable SSL if available (for production)
if (process.env.DB_SSL === 'true') {
  dbConfig.ssl = {
    // Don't reject unauthorized certificates (needed for some cloud databases)
    rejectUnauthorized: false,
  };
  console.log('Database: SSL enabled');
}

// Create connection pool
const pool = new Pool(dbConfig);

// Log pool errors
pool.on('error', (err) => {
  console.error('Unexpected database pool error:', err);
});

// Log successful connections in development
pool.on('connect', () => {
  if (process.env.NODE_ENV === 'development') {
    console.log('New database client connected');
  }
});

/**
 * Execute a query with parameters
 * @param {string} text - SQL query text
 * @param {Array} params - Query parameters
 * @returns {Promise<pg.QueryResult>}
 */
export async function query(text, params = []) {
  const start = Date.now();
  try {
    const result = await pool.query(text, params);
    const duration = Date.now() - start;
    if (process.env.NODE_ENV === 'development') {
      console.log('Query executed:', { text: text.substring(0, 100), duration, rows: result.rowCount });
    }
    return result;
  } catch (error) {
    console.error('Query error:', { text: text.substring(0, 100), error: error.message });
    throw error;
  }
}

/**
 * Get a single row from query result
 * @param {string} text - SQL query text
 * @param {Array} params - Query parameters
 * @returns {Promise<Object|null>}
 */
export async function queryOne(text, params = []) {
  const result = await query(text, params);
  return result.rows[0] || null;
}

/**
 * Get all rows from query result
 * @param {string} text - SQL query text
 * @param {Array} params - Query parameters
 * @returns {Promise<Array>}
 */
export async function queryAll(text, params = []) {
  const result = await query(text, params);
  return result.rows;
}

/**
 * Get a client from the pool for transactions
 * @returns {Promise<pg.PoolClient>}
 */
export async function getClient() {
  const client = await pool.connect();
  return client;
}

/**
 * Execute a transaction with automatic rollback on error
 * @param {Function} callback - Async function receiving the client
 * @returns {Promise<any>} - Result of the callback
 */
export async function transaction(callback) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await callback(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Check database connection health
 * @returns {Promise<boolean>}
 */
export async function healthCheck() {
  try {
    const result = await query('SELECT NOW() as time, current_database() as database');
    return {
      healthy: true,
      database: result.rows[0].database,
      timestamp: result.rows[0].time,
    };
  } catch (error) {
    return {
      healthy: false,
      error: error.message,
    };
  }
}

/**
 * Close all pool connections (for graceful shutdown)
 */
export async function close() {
  await pool.end();
  console.log('Database pool closed');
}

/**
 * Get pool statistics
 * @returns {Object}
 */
export function getPoolStats() {
  return {
    total: pool.totalCount,
    idle: pool.idleCount,
    waiting: pool.waitingCount,
  };
}

// Export pool for advanced usage
export { pool };

export default {
  query,
  queryOne,
  queryAll,
  getClient,
  transaction,
  healthCheck,
  close,
  getPoolStats,
  pool,
};
