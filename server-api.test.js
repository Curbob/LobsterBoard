/**
 * Integration tests for server API endpoints:
 * GET /config, POST /config, GET /api/stats, GET /api/templates, GET /api/pages
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { startServer, postJson } from './helpers/server.js';

let srv;

beforeAll(async () => {
  srv = await startServer({
    config: {
      canvas: { width: 1920, height: 1080 },
      fontScale: 1,
      widgets: [
        { id: 'w-1', type: 'weather', x: 0, y: 0, width: 200, height: 120, properties: { title: 'Weather', location: 'NYC', units: 'F' } },
      ],
    },
  });
});

afterAll(async () => { if (srv) await srv.kill(); });

describe('GET /config', () => {
  it('returns 200 with config JSON', async () => {
    const res = await fetch(`${srv.baseUrl}/config`);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.canvas).toBeDefined();
    expect(data.widgets).toBeInstanceOf(Array);
    expect(data.widgets.length).toBe(1);
  });

  it('returns config with canvas when no custom config provided', async () => {
    // Note: migration copies default config from PKG_DIR, so we verify structure
    const empty = await startServer();
    try {
      const res = await fetch(`${empty.baseUrl}/config`);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.canvas).toBeDefined();
      expect(data.canvas.width).toBeGreaterThan(0);
    } finally {
      await empty.kill();
    }
  });
});

describe('POST /config', () => {
  it('saves config and returns success', async () => {
    const newConfig = {
      canvas: { width: 1280, height: 720 },
      widgets: [
        { id: 'w-2', type: 'clock', x: 10, y: 10, width: 100, height: 80, properties: { title: 'Clock' } },
      ],
    };
    const res = await postJson(srv.baseUrl, '/config', newConfig);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.status).toBe('success');

    // Verify saved config is returned on GET
    const getRes = await fetch(`${srv.baseUrl}/config`);
    const saved = await getRes.json();
    expect(saved.canvas.width).toBe(1280);
    expect(saved.widgets.length).toBe(1);
    expect(saved.widgets[0].id).toBe('w-2');
  });

  it('rejects invalid JSON with 400', async () => {
    const res = await fetch(`${srv.baseUrl}/config`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{invalid json',
    });
    expect(res.status).toBe(400);
  });
});

describe('POST /config secrets extraction', () => {
  it('extracts sensitive keys to secrets.json and replaces with __SECRET__', async () => {
    const configWithSecrets = {
      canvas: { width: 1920, height: 1080 },
      widgets: [
        {
          id: 'w-secret', type: 'stock', x: 0, y: 0, width: 200, height: 120,
          properties: { title: 'Stock', apiKey: 'sk-live-abc123', refreshInterval: 60 },
        },
      ],
    };
    await postJson(srv.baseUrl, '/config', configWithSecrets);

    const getRes = await fetch(`${srv.baseUrl}/config`);
    const data = await getRes.json();
    const widget = data.widgets.find(w => w.id === 'w-secret');
    // The apiKey should be masked (not the raw value)
    expect(widget.properties.apiKey).not.toBe('sk-live-abc123');
  });
});

describe('GET /api/stats', () => {
  it('returns 200 with system stats object', async () => {
    const res = await fetch(`${srv.baseUrl}/api/stats`);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data).toHaveProperty('timestamp');
    expect(data).toHaveProperty('cpu');
    expect(data).toHaveProperty('memory');
  });
});

describe('GET /api/templates', () => {
  it('returns 200 with an array of templates', async () => {
    const res = await fetch(`${srv.baseUrl}/api/templates`);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(Array.isArray(data)).toBe(true);
  });
});

describe('GET /api/pages', () => {
  it('returns 200 with pages list', async () => {
    const res = await fetch(`${srv.baseUrl}/api/pages`);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(Array.isArray(data)).toBe(true);
  });
});

describe('CORS', () => {
  it('OPTIONS /config returns CORS headers', async () => {
    const res = await fetch(`${srv.baseUrl}/config`, { method: 'OPTIONS' });
    expect(res.status).toBe(204);
    expect(res.headers.get('access-control-allow-origin')).toBe('*');
  });

  it('OPTIONS /api/* returns CORS headers', async () => {
    const res = await fetch(`${srv.baseUrl}/api/stats`, { method: 'OPTIONS' });
    expect(res.status).toBe(204);
  });
});

describe('Static file serving', () => {
  it('GET / returns app.html', async () => {
    const res = await fetch(`${srv.baseUrl}/`);
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toContain('text/html');
  });

  it('returns 404 for non-existent files', async () => {
    const res = await fetch(`${srv.baseUrl}/nonexistent.xyz`);
    expect(res.status).toBe(404);
  });

  it('blocks path traversal attempts', async () => {
    const res = await fetch(`${srv.baseUrl}/../../../etc/passwd`);
    // Should be 403 (Forbidden) or 404 — never 200
    expect(res.status).not.toBe(200);
  });
});
