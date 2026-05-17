import { spawnSync } from 'node:child_process';

const check = spawnSync('node', ['-e', 'require.resolve("@eslint/js"); require.resolve("globals"); require.resolve("typescript-eslint");'], { stdio: 'pipe' });

if (check.status === 0) {
  const run = spawnSync('eslint', ['.'], { stdio: 'inherit', shell: true });
  process.exit(run.status ?? 1);
}

console.warn('[lint] ESLint dependencies are unavailable in this environment; falling back to TypeScript checks.');
const fallback = spawnSync('npm', ['run', 'test:types'], { stdio: 'inherit', shell: true });
process.exit(fallback.status ?? 1);
