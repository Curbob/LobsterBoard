/**
 * Test helper — spawns the LobsterBoard server on a random port
 * and returns { baseUrl, process, kill() }.
 *
 * Usage:
 *   const srv = await startServer();
 *   // ... fetch(srv.baseUrl + '/api/stats') ...
 *   await srv.kill();
 */

import { spawn } from 'node:child_process';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

/**
 * Start a server instance in an isolated temp working directory.
 * @param {object} opts
 * @param {string} [opts.password]  - DASHBOARD_PASSWORD env var
 * @param {number} [opts.port]      - override port (default: random 10000-60000)
 * @param {object} [opts.config]    - initial config.json contents
 * @param {object} [opts.auth]      - initial auth.json contents
 * @param {object} [opts.secrets]   - initial secrets.json contents
 * @returns {Promise<{baseUrl: string, port: number, cwd: string, kill: () => Promise<void>}>}
 */
export async function startServer(opts = {}) {
  const port = opts.port || (10000 + Math.floor(Math.random() * 50000));
  const cwd = mkdtempSync(join(tmpdir(), 'lb-test-'));

  // Seed data files if provided
  if (opts.config) writeFileSync(join(cwd, 'config.json'), JSON.stringify(opts.config, null, 2));
  if (opts.auth) writeFileSync(join(cwd, 'auth.json'), JSON.stringify(opts.auth, null, 2));
  if (opts.secrets) writeFileSync(join(cwd, 'secrets.json'), JSON.stringify(opts.secrets, null, 2));

  const env = {
    ...process.env,
    PORT: String(port),
    HOST: '127.0.0.1',
    LOBSTERBOARD_PKG_DIR: join(process.cwd()),
  };
  if (opts.password) env.DASHBOARD_PASSWORD = opts.password;

  const child = spawn('node', [join(process.cwd(), 'server.cjs')], { cwd, env, stdio: 'pipe' });

  const baseUrl = `http://127.0.0.1:${port}`;

  // Wait for server to be ready (listen message or successful fetch)
  await new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error('Server start timeout')), 10000);
    let output = '';

    child.stdout.on('data', (d) => {
      output += d.toString();
      if (output.includes('running at')) {
        clearTimeout(timeout);
        resolve();
      }
    });
    child.stderr.on('data', (d) => {
      output += d.toString();
    });
    child.on('error', (err) => { clearTimeout(timeout); reject(err); });
    child.on('exit', (code) => {
      if (code !== null && code !== 0) {
        clearTimeout(timeout);
        reject(new Error(`Server exited with code ${code}: ${output}`));
      }
    });
  });

  return {
    baseUrl,
    port,
    cwd,
    kill: () => new Promise((resolve) => {
      child.on('exit', () => {
        try { rmSync(cwd, { recursive: true, force: true }); } catch (_) {}
        resolve();
      });
      child.kill('SIGTERM');
      // Force kill after 3s
      setTimeout(() => { try { child.kill('SIGKILL'); } catch (_) {} }, 3000);
    }),
  };
}

/**
 * Helper to POST JSON to the server.
 */
export function postJson(baseUrl, path, body) {
  return fetch(`${baseUrl}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}
