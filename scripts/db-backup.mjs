#!/usr/bin/env node

/**
 * Database backup script
 * Creates a compressed backup of the PostgreSQL database
 * Usage: npm run db:backup
 */

import { spawn } from 'child_process';
import { writeFileSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { logger } from '../src/lib/logger.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, '..');

const { DATABASE_URL } = process.env;

if (!DATABASE_URL) {
  logger.error('DATABASE_URL environment variable is required');
  process.exit(1);
}

const url = new URL(DATABASE_URL);
const host = url.hostname;
const port = url.port || '5432';
const database = url.pathname.slice(1);
const user = url.username;
const password = url.password;

const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
const backupFile = path.join(projectRoot, 'backups', `${database}-${timestamp}.sql.gz`);
const backupDir = path.dirname(backupFile);

logger.info({
  type: 'db_backup_start',
  database,
  backupFile,
  timestamp,
});

// Create backups directory if it doesn't exist
import('fs').then(({ mkdirSync }) => {
  try {
    mkdirSync(backupDir, { recursive: true });
  } catch (error) {
    if ((error as any).code !== 'EEXIST') throw error;
  }
});

const env = { ...process.env, PGPASSWORD: password };

const pg_dump = spawn('pg_dump', [
  `-h${host}`,
  `-p${port}`,
  `-U${user}`,
  '--verbose',
  '--format=plain',
  database,
], { env });

const gzip = spawn('gzip', ['-9', `-c`]);

const writeStream = (await import('fs')).createWriteStream(backupFile);

pg_dump.stdout.pipe(gzip.stdin);
gzip.stdout.pipe(writeStream);

let errorOccurred = false;

pg_dump.on('error', (error) => {
  errorOccurred = true;
  logger.error({
    type: 'db_backup_error',
    message: 'pg_dump failed',
    error: error.message,
  });
});

gzip.on('error', (error) => {
  errorOccurred = true;
  logger.error({
    type: 'db_backup_error',
    message: 'gzip failed',
    error: error.message,
  });
});

writeStream.on('error', (error) => {
  errorOccurred = true;
  logger.error({
    type: 'db_backup_error',
    message: 'write failed',
    error: error.message,
  });
});

writeStream.on('finish', () => {
  if (errorOccurred) {
    logger.error({
      type: 'db_backup_failed',
      database,
    });
    process.exit(1);
  }

  logger.info({
    type: 'db_backup_success',
    database,
    backupFile,
  });
});
