// @ts-nocheck
/**
 * Database initialization module
 * Creates connection pool and initializes migrations
 */

import pkg from 'pg';
import { logger } from '../lib/logger.js';

const { Pool } = pkg;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: parseInt(process.env.DB_POOL_SIZE || '10'),
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

pool.on('error', (err) => {
  logger.error({
    type: 'db_pool_error',
    message: err.message,
    stack: err.stack,
  });
});

/**
 * Initialize database connection and verify connectivity
 */
export async function initializeDatabase() {
  try {
    const client = await pool.connect();
    logger.info({
      type: 'db_connected',
      message: 'Successfully connected to PostgreSQL',
    });
    client.release();
    return pool;
  } catch (error) {
    logger.error({
      type: 'db_connection_failed',
      message: (error as Error).message,
    });
    throw error;
  }
}

/**
 * Get a client from the pool
 */
export async function getDbClient() {
  return pool.connect();
}

/**
 * Close the connection pool
 */
export async function closeDatabase() {
  return pool.end();
}

export { pool };
