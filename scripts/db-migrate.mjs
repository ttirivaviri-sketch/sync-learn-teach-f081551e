#!/usr/bin/env node

/**
 * Database migration runner using Flyway
 * Usage: npm run db:migrate [target]
 */

import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';
import { logger } from '../src/lib/logger.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, '..');

const {
  DATABASE_URL,
  ENVIRONMENT = 'development',
} = process.env;

if (!DATABASE_URL) {
  logger.error('DATABASE_URL environment variable is required');
  process.exit(1);
}

// Parse DATABASE_URL
const url = new URL(DATABASE_URL);
const host = url.hostname;
const port = url.port || '5432';
const database = url.pathname.slice(1);
const user = url.username;
const password = url.password;

logger.info({
  type: 'db_migration_start',
  host,
  database,
  environment: ENVIRONMENT,
});

const flywayArgs = [
  `-url=jdbc:postgresql://${host}:${port}/${database}`,
  `-user=${user}`,
  `-password=${password}`,
  `-locations=filesystem:${projectRoot}/db/migrations`,
  'migrate',
];

const flyway = spawn('flyway', flywayArgs, {
  cwd: projectRoot,
  stdio: 'inherit',
});

flyway.on('error', (error) => {
  logger.error({
    type: 'db_migration_error',
    message: error.message,
  });
  process.exit(1);
});

flyway.on('exit', (code) => {
  if (code === 0) {
    logger.info({
      type: 'db_migration_success',
      database,
    });
  } else {
    logger.error({
      type: 'db_migration_failed',
      code,
    });
  }
  process.exit(code);
});
