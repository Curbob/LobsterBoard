/**
 * Tests for the data-folder layout used by the Docker image, and guards that the
 * regular (non-Docker) install keeps behaving exactly as before.
 *
 * - LOBSTERBOARD_TEMPLATES_DIR: user templates outside the app folder
 * - pages/_shared fallback when a user pages/ folder exists
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { existsSync, mkdirSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { startServer, postJson } from '../helpers/server.js';

const BUNDLED_TEMPLATES = join(process.cwd(), 'templates');
const bundledIds = () => readdirSync(BUNDLED_TEMPLATES).filter(d => existsSync(join(BUNDLED_TEMPLATES, d, 'meta.json')));

describe('templates without LOBSTERBOARD_TEMPLATES_DIR (existing installs)', () => {
  let srv;
  beforeAll(async () => {
    srv = await startServer({ env: { LOBSTERBOARD_TEMPLATES_DIR: '' } });
  });
  afterAll(async () => { if (srv) await srv.kill(); });

  it('lists exactly the bundled templates', async () => {
    const res = await fetch(`${srv.baseUrl}/api/templates`);
    const ids = (await res.json()).map(t => t.id).sort();
    expect(ids).toEqual(bundledIds().sort());
  });

  it('does not create a templates folder in the working directory', () => {
    expect(existsSync(join(srv.cwd, 'templates'))).toBe(false);
  });
});

describe('templates with LOBSTERBOARD_TEMPLATES_DIR (Docker layout)', () => {
  let srv, userDir;
  const ID = 'docker-layout-test-tpl';

  beforeAll(async () => {
    srv = await startServer({
      config: { canvas: { width: 800, height: 600 }, widgets: [{ id: 'w1', type: 'clock', x: 0, y: 0, width: 100, height: 80, properties: {} }] },
      env: { LOBSTERBOARD_TEMPLATES_DIR: 'templates' }, // relative → resolved against the working dir
    });
    userDir = join(srv.cwd, 'templates');
  });
  afterAll(async () => { if (srv) await srv.kill(); });

  it('exports into the user folder, not the app folder', async () => {
    const res = await postJson(srv.baseUrl, '/api/templates/export', { name: 'Docker Layout Test Tpl', description: 'x' });
    expect(res.status).toBe(200);
    expect(existsSync(join(userDir, ID, 'config.json'))).toBe(true);
    expect(existsSync(join(BUNDLED_TEMPLATES, ID))).toBe(false);
  });

  it('lists user templates plus bundled ones', async () => {
    const ids = (await (await fetch(`${srv.baseUrl}/api/templates`)).json()).map(t => t.id);
    expect(ids).toContain(ID);
    for (const id of bundledIds()) expect(ids).toContain(id);
  });

  it('serves and imports bundled templates', async () => {
    const id = bundledIds()[0];
    expect((await fetch(`${srv.baseUrl}/api/templates/${id}`)).status).toBe(200);
    const res = await postJson(srv.baseUrl, '/api/templates/import', { id, mode: 'merge' });
    expect(res.status).toBe(200);
  });

  it('saves screenshots and deletes user templates', async () => {
    const png = 'data:image/png;base64,' + Buffer.from('fake').toString('base64');
    expect((await postJson(srv.baseUrl, `/api/templates/${ID}/screenshot`, { data: png })).status).toBe(200);
    expect(existsSync(join(userDir, ID, 'preview.png'))).toBe(true);
    expect((await fetch(`${srv.baseUrl}/api/templates/${ID}/preview`)).status).toBe(200);

    expect((await fetch(`${srv.baseUrl}/api/templates/${ID}`, { method: 'DELETE' })).status).toBe(200);
    expect(existsSync(join(userDir, ID))).toBe(false);
  });
});

describe('pages/_shared with a user pages folder', () => {
  let srv;
  beforeAll(async () => {
    srv = await startServer({ setup: (cwd) => mkdirSync(join(cwd, 'pages'), { recursive: true }) });
  });
  afterAll(async () => { if (srv) await srv.kill(); });

  it('falls back to the bundled shared files', async () => {
    const res = await fetch(`${srv.baseUrl}/pages/_shared/nav.js`);
    expect(res.status).toBe(200);
  });
});
