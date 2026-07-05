/**
 * Simple test runner for Vitest.
 * Run this with: npm test
 */

import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, '..');

const vitestProcess = spawn('npx', ['vitest', 'run'], {
  cwd: projectRoot,
  stdio: 'inherit',
  shell: true,
});

vitestProcess.on('exit', (code) => {
  process.exit(code || 0);
});