const { spawn, execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const rootDir = path.resolve(__dirname, '..');
const nodeModulesDir = path.join(rootDir, 'node_modules');

function ensureWindowsBinaries() {
  const isWin = process.platform === 'win32';
  if (!isWin) return;

  const esbuildWin = path.join(nodeModulesDir, '@esbuild', 'win32-x64');
  const rollupWin = path.join(nodeModulesDir, '@rollup', 'rollup-win32-x64-msvc');
  const packages = [];

  if (!fs.existsSync(esbuildWin)) {
    packages.push('@esbuild/win32-x64@0.25.12');
  }
  if (!fs.existsSync(rollupWin)) {
    packages.push('@rollup/rollup-win32-x64-msvc@4.55.1');
  }

  if (packages.length > 0) {
    console.log(`[dev-runner] Installing missing Windows binaries: ${packages.join(' ')}...`);
    try {
      execSync(`npm install --no-save --no-audit --no-fund ${packages.join(' ')}`, {
        cwd: rootDir,
        stdio: 'inherit',
      });
      console.log('[dev-runner] Windows native binaries installed successfully.');
    } catch (err) {
      console.error('[dev-runner] Failed to install native binaries:', err.message);
    }
  }

  // Ensure tsx can resolve esbuild win32-x64 binary
  const tsxEsbuildDir = path.join(nodeModulesDir, 'tsx', 'node_modules', '@esbuild');
  const tsxEsbuildLinux = path.join(tsxEsbuildDir, 'linux-x64');
  const tsxEsbuildWin = path.join(tsxEsbuildDir, 'win32-x64');

  if (fs.existsSync(tsxEsbuildLinux)) {
    try {
      fs.rmSync(tsxEsbuildLinux, { recursive: true, force: true });
    } catch (e) {}
  }

  const rootEsbuildWin = path.join(nodeModulesDir, '@esbuild', 'win32-x64');
  if (fs.existsSync(rootEsbuildWin) && !fs.existsSync(tsxEsbuildWin)) {
    try {
      fs.mkdirSync(tsxEsbuildDir, { recursive: true });
      fs.cpSync(rootEsbuildWin, tsxEsbuildWin, { recursive: true });
      console.log('[dev-runner] Copied win32-x64 esbuild binary to tsx nested module.');
    } catch (e) {
      console.warn('[dev-runner] Notice copying esbuild to tsx:', e.message);
    }
  }
}

ensureWindowsBinaries();

console.log('[dev-runner] Starting Express backend & Vite frontend...');

const viteCli = path.join(nodeModulesDir, 'vite', 'bin', 'vite.js');

const backend = spawn(process.execPath, ['--import', 'tsx', 'server/index.ts'], {
  cwd: rootDir,
  env: { ...process.env, NODE_ENV: 'development', FORCE_COLOR: '1' },
});

backend.stdout.on('data', (d) => process.stdout.write(`[backend] ${d}`));
backend.stderr.on('data', (d) => process.stderr.write(`[backend-err] ${d}`));
backend.on('error', (err) => console.error('[backend spawn error]', err));
backend.on('exit', (code, signal) => console.log(`[backend exit] code=${code} signal=${signal}`));

const frontend = spawn(process.execPath, [viteCli], {
  cwd: rootDir,
  env: { ...process.env, FORCE_COLOR: '1' },
});

frontend.stdout.on('data', (d) => process.stdout.write(`[frontend] ${d}`));
frontend.stderr.on('data', (d) => process.stderr.write(`[frontend-err] ${d}`));
frontend.on('error', (err) => console.error('[frontend spawn error]', err));
frontend.on('exit', (code, signal) => console.log(`[frontend exit] code=${code} signal=${signal}`));

function cleanup() {
  if (backend && !backend.killed) backend.kill();
  if (frontend && !frontend.killed) frontend.kill();
  process.exit();
}

process.on('SIGINT', cleanup);
process.on('SIGTERM', cleanup);
process.on('exit', cleanup);
