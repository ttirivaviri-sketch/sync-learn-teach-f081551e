#!/usr/bin/env node

/**
 * Database restore script
 * Restores a database from a compressed backup
 * Usage: npm run db:restore -- <backup-file>
 */

import { spawn } from 'child_process';
import { existsSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { logger } from '../src/lib/logger.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, '..');

const { DATABASE_URL } = process.env;
const backupFile = process.argv[2];

if (!DATABASE_URL) {
  logger.error('DATABASE_URL environment variable is required');
  process.exit(1);
}

if (!backupFile) {
  logger.error('Backup file path is required');
  logger.info('Usage: npm run db:restore -- <backup-file>');
  process.exit(1);
}

if (!existsSync(backupFile)) {
  logger.error(`Backup file not found: ${backupFile}`);
  process.exit(1);
}

const url = new URL(DATABASE_URL);
const host = url.hostname;
const port = url.port || '5432';
const database = url.pathname.slice(1);
const user = url.username;
const password = url.password;

logger.warn({
  type: 'db_restore_start',
  database,
  backupFile,
  message: 'CAUTION: This will overwrite the current database!',
});

const env = { ...process.env, PGPASSWORD: password };

// First, decompress the backup
const gunzip = spawn('gunzip', ['-c', backupFile]);

// Then pipe to psql for restore
const psql = spawn('psql', [
  `-h${host}`,
  `-p${port}`,
  `-U${user}`,
  `-d${database}`,
], { env });

gunzip.stdout.pipe(psql.stdin);

let errorOccurred = false;

gunzip.on('error', (error) => {
  errorOccurred = true;
  logger.error({
    type: 'db_restore_error',
    message: 'gunzip failed',
    error: error.message,
  });
});

psql.on('error', (error) => {
  errorOccurred = true;
  logger.error({
    type: 'db_restore_error',
    message: 'psql failed',
    error: error.message,
  });
});

psql.on('exit', (code) => {
  if (code === 0 && !errorOccurred) {
    logger.info({
      type: 'db_restore_success',
      database,
      backupFile,
    });
  } else {
    logger.error({
      type: 'db_restore_failed',
      database,
      code,
    });
  }
  process.exit(code);
});
