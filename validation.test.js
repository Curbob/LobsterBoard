/**
 * Tests for server/validation.cjs — config schema validation,
 * request body validation, HTML escaping, and security headers.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { startServer, postJson } from './helpers/server.js';

// Direct unit tests for validation module
const {
  validateConfigSchema,
  validateTodos,
  validateNotes,
  validateServerProfile,
  validateTemplateImport,
  validateTemplateExport,
  escapeHtml,
  sanitizeWidgetProperties,
  sanitizeConfig,
} = await import('./server/validation.cjs');

describe('validateConfigSchema', () => {
  it('accepts a valid config', () => {
    const result = validateConfigSchema({
      canvas: { width: 1920, height: 1080 },
      fontScale: 1.25,
      widgets: [
        { id: 'w-1', type: 'clock', x: 10, y: 20, width: 200, height: 100, properties: { title: 'Clock' } },
      ],
    });
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('rejects non-object config', () => {
    expect(validateConfigSchema('string').valid).toBe(false);
    expect(validateConfigSchema(null).valid).toBe(false);
    expect(validateConfigSchema([]).valid).toBe(false);
  });

  it('rejects canvas dimensions out of bounds', () => {
    const result = validateConfigSchema({
      canvas: { width: 100, height: 100000 },
    });
    expect(result.valid).toBe(false);
    expect(result.errors.length).toBeGreaterThanOrEqual(2);
  });

  it('rejects non-finite canvas dimensions', () => {
    const result = validateConfigSchema({
      canvas: { width: NaN, height: Infinity },
    });
    expect(result.valid).toBe(false);
  });

  it('rejects fontScale out of range', () => {
    expect(validateConfigSchema({ fontScale: 0 }).valid).toBe(false);
    expect(validateConfigSchema({ fontScale: 100 }).valid).toBe(false);
  });

  it('rejects too many widgets', () => {
    const widgets = Array.from({ length: 501 }, (_, i) => ({
      id: `w-${i}`, type: 'clock', x: 0, y: 0, width: 100, height: 100,
    }));
    const result = validateConfigSchema({ widgets });
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.includes('exceeds maximum'))).toBe(true);
  });

  it('rejects widgets with missing id or type', () => {
    const result = validateConfigSchema({
      widgets: [{ x: 0, y: 0, width: 100, height: 100 }],
    });
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.includes('id'))).toBe(true);
    expect(result.errors.some(e => e.includes('type'))).toBe(true);
  });

  it('rejects widget positions out of bounds', () => {
    const result = validateConfigSchema({
      widgets: [{ id: 'w', type: 'test', x: -99999, y: 0, width: 100, height: 100 }],
    });
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.includes('out of bounds'))).toBe(true);
  });

  it('rejects widget string properties exceeding max length', () => {
    const result = validateConfigSchema({
      widgets: [{
        id: 'w', type: 'test', x: 0, y: 0, width: 100, height: 100,
        properties: { title: 'x'.repeat(10001) },
      }],
    });
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.includes('maximum string length'))).toBe(true);
  });

  it('accepts config with no widgets', () => {
    const result = validateConfigSchema({ canvas: { width: 1920, height: 1080 } });
    expect(result.valid).toBe(true);
  });
});

describe('validateTodos', () => {
  it('accepts an array', () => {
    expect(validateTodos([]).valid).toBe(true);
    expect(validateTodos([{ text: 'test', done: false }]).valid).toBe(true);
  });

  it('rejects non-array', () => {
    expect(validateTodos({}).valid).toBe(false);
    expect(validateTodos('string').valid).toBe(false);
  });
});

describe('validateNotes', () => {
  it('accepts an object', () => {
    expect(validateNotes({}).valid).toBe(true);
  });

  it('rejects non-object', () => {
    expect(validateNotes([]).valid).toBe(false);
    expect(validateNotes('string').valid).toBe(false);
  });
});

describe('validateServerProfile', () => {
  it('accepts valid profile', () => {
    expect(validateServerProfile({ name: 'Test', url: 'http://test.com', apiKey: 'key123' }).valid).toBe(true);
  });

  it('rejects missing fields', () => {
    expect(validateServerProfile({}).valid).toBe(false);
    expect(validateServerProfile({ name: 'Test' }).valid).toBe(false);
  });
});

describe('validateTemplateImport', () => {
  it('accepts valid import', () => {
    expect(validateTemplateImport({ id: 'tpl-1', mode: 'replace' }).valid).toBe(true);
    expect(validateTemplateImport({ id: 'tpl-1', mode: 'merge' }).valid).toBe(true);
  });

  it('rejects invalid mode', () => {
    expect(validateTemplateImport({ id: 'tpl-1', mode: 'invalid' }).valid).toBe(false);
  });

  it('rejects missing id', () => {
    expect(validateTemplateImport({ mode: 'replace' }).valid).toBe(false);
  });
});

describe('validateTemplateExport', () => {
  it('accepts valid export', () => {
    expect(validateTemplateExport({ name: 'My Template' }).valid).toBe(true);
  });

  it('rejects missing name', () => {
    expect(validateTemplateExport({}).valid).toBe(false);
  });
});

describe('escapeHtml', () => {
  it('escapes HTML special characters', () => {
    expect(escapeHtml('<script>alert("xss")</script>')).toBe('&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;');
  });

  it('escapes ampersands', () => {
    expect(escapeHtml('a&b')).toBe('a&amp;b');
  });

  it('escapes single quotes', () => {
    expect(escapeHtml("it's")).toBe('it&#x27;s');
  });

  it('handles null and undefined', () => {
    expect(escapeHtml(null)).toBe('');
    expect(escapeHtml(undefined)).toBe('');
  });

  it('converts non-strings', () => {
    expect(escapeHtml(42)).toBe('42');
  });
});

describe('sanitizeWidgetProperties', () => {
  it('escapes string values in properties', () => {
    const result = sanitizeWidgetProperties({ title: '<b>Bold</b>', count: 5 });
    expect(result.title).toBe('&lt;b&gt;Bold&lt;/b&gt;');
    expect(result.count).toBe(5);
  });

  it('handles nested objects', () => {
    const result = sanitizeWidgetProperties({
      links: [{ name: '<script>', url: 'https://example.com' }],
    });
    expect(result.links[0].name).toBe('&lt;script&gt;');
    expect(result.links[0].url).toBe('https://example.com');
  });

  it('handles null/undefined', () => {
    expect(sanitizeWidgetProperties(null)).toBe(null);
    expect(sanitizeWidgetProperties(undefined)).toBe(undefined);
  });
});

describe('sanitizeConfig', () => {
  it('sanitizes all widget properties in config', () => {
    const config = {
      canvas: { width: 1920, height: 1080 },
      widgets: [
        { id: 'w-1', type: 'text', properties: { title: '<img src=x onerror=alert(1)>' } },
      ],
    };
    const result = sanitizeConfig(config);
    expect(result.widgets[0].properties.title).toBe('&lt;img src=x onerror=alert(1)&gt;');
    expect(result.canvas).toEqual(config.canvas);
  });

  it('passes through widgets without properties', () => {
    const config = { widgets: [{ id: 'w-1', type: 'test' }] };
    const result = sanitizeConfig(config);
    expect(result.widgets[0]).toEqual(config.widgets[0]);
  });
});

// Integration tests
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

describe('POST /config validation (integration)', () => {
  it('rejects config with invalid canvas dimensions', async () => {
    const res = await postJson(srv.baseUrl, '/config', {
      canvas: { width: 0, height: -100 },
      widgets: [],
    });
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.message).toContain('validation failed');
  });

  it('rejects config with malformed widgets', async () => {
    const res = await postJson(srv.baseUrl, '/config', {
      canvas: { width: 1920, height: 1080 },
      widgets: [{ x: 0 }],
    });
    expect(res.status).toBe(400);
  });

  it('accepts valid config', async () => {
    const res = await postJson(srv.baseUrl, '/config', {
      canvas: { width: 1920, height: 1080 },
      widgets: [
        { id: 'w-test', type: 'clock', x: 0, y: 0, width: 200, height: 100, properties: { title: 'Test' } },
      ],
    });
    expect(res.status).toBe(200);
  });
});

describe('GET /config sanitization (integration)', () => {
  it('returns HTML-escaped widget properties', async () => {
    // Save config with XSS attempt
    await postJson(srv.baseUrl, '/config', {
      canvas: { width: 1920, height: 1080 },
      widgets: [
        { id: 'w-xss', type: 'text-header', x: 0, y: 0, width: 200, height: 100, properties: { title: '<script>alert(1)</script>' } },
      ],
    });

    const res = await fetch(`${srv.baseUrl}/config`);
    const data = await res.json();
    const widget = data.widgets.find(w => w.id === 'w-xss');
    expect(widget.properties.title).not.toContain('<script>');
    expect(widget.properties.title).toContain('&lt;script&gt;');
  });
});

describe('Security headers (integration)', () => {
  it('includes Content-Security-Policy on HTML responses', async () => {
    const res = await fetch(`${srv.baseUrl}/`);
    expect(res.headers.get('content-security-policy')).toBeTruthy();
    expect(res.headers.get('content-security-policy')).toContain("default-src 'self'");
  });

  it('includes X-Content-Type-Options', async () => {
    const res = await fetch(`${srv.baseUrl}/`);
    expect(res.headers.get('x-content-type-options')).toBe('nosniff');
  });

  it('includes X-Frame-Options', async () => {
    const res = await fetch(`${srv.baseUrl}/`);
    expect(res.headers.get('x-frame-options')).toBe('SAMEORIGIN');
  });

  it('includes security headers on API responses', async () => {
    const res = await fetch(`${srv.baseUrl}/config`);
    expect(res.headers.get('content-security-policy')).toBeTruthy();
    expect(res.headers.get('x-content-type-options')).toBe('nosniff');
  });

  it('includes Referrer-Policy', async () => {
    const res = await fetch(`${srv.baseUrl}/`);
    expect(res.headers.get('referrer-policy')).toBe('strict-origin-when-cross-origin');
  });
});

describe('POST /api/todos validation (integration)', () => {
  it('rejects non-array body', async () => {
    const res = await postJson(srv.baseUrl, '/api/todos', { not: 'an array' });
    expect(res.status).toBe(400);
  });

  it('accepts valid array body', async () => {
    const res = await postJson(srv.baseUrl, '/api/todos', [{ text: 'test', done: false }]);
    expect(res.status).toBe(200);
  });
});

describe('POST /api/notes validation (integration)', () => {
  it('rejects array body', async () => {
    const res = await postJson(srv.baseUrl, '/api/notes', [1, 2, 3]);
    expect(res.status).toBe(400);
  });

  it('accepts valid object body', async () => {
    const res = await postJson(srv.baseUrl, '/api/notes', { content: 'note text' });
    expect(res.status).toBe(200);
  });
});
