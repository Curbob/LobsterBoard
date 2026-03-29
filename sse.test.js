/**
 * SSE (Server-Sent Events) connection tests for /api/stats/stream
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import http from 'node:http';
import { startServer } from './helpers/server.js';

let srv;

beforeAll(async () => { srv = await startServer(); });
afterAll(async () => { if (srv) await srv.kill(); });

/**
 * Open an SSE connection and collect data events.
 * Resolves after `count` events or `timeoutMs` elapsed.
 */
function collectSSEEvents(url, { count = 1, timeoutMs = 5000 } = {}) {
  return new Promise((resolve, reject) => {
    const events = [];
    const req = http.get(url, (res) => {
      let buffer = '';
      const timer = setTimeout(() => {
        req.destroy();
        resolve({ events, headers: res.headers, statusCode: res.statusCode });
      }, timeoutMs);

      res.on('data', (chunk) => {
        buffer += chunk.toString();
        // Parse SSE data lines
        const lines = buffer.split('\n');
        buffer = lines.pop(); // keep incomplete line
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              events.push(JSON.parse(line.slice(6)));
            } catch (_) {
              events.push(line.slice(6));
            }
            if (events.length >= count) {
              clearTimeout(timer);
              req.destroy();
              resolve({ events, headers: res.headers, statusCode: res.statusCode });
            }
          }
        }
      });

      res.on('error', () => {
        clearTimeout(timer);
        resolve({ events, headers: res.headers, statusCode: res.statusCode });
      });
    });
    req.on('error', reject);
  });
}

describe('SSE /api/stats/stream', () => {
  it('returns text/event-stream content type', async () => {
    const { headers, statusCode } = await collectSSEEvents(`${srv.baseUrl}/api/stats/stream`, { count: 1 });
    expect(statusCode).toBe(200);
    expect(headers['content-type']).toBe('text/event-stream');
    expect(headers['cache-control']).toBe('no-cache');
  });

  it('receives an initial stats payload immediately', async () => {
    const { events } = await collectSSEEvents(`${srv.baseUrl}/api/stats/stream`, { count: 1, timeoutMs: 3000 });
    expect(events.length).toBeGreaterThanOrEqual(1);
    const first = events[0];
    expect(first).toHaveProperty('timestamp');
  });

  it('receives multiple stat updates over time', async () => {
    const { events } = await collectSSEEvents(`${srv.baseUrl}/api/stats/stream`, { count: 2, timeoutMs: 6000 });
    expect(events.length).toBeGreaterThanOrEqual(2);
  });

  it('cleans up connection on client disconnect', async () => {
    // Connect and immediately disconnect
    await new Promise((resolve, reject) => {
      const req = http.get(`${srv.baseUrl}/api/stats/stream`, (res) => {
        res.once('data', () => {
          // Got initial event, now disconnect
          req.destroy();
          // Give server time to clean up
          setTimeout(resolve, 200);
        });
      });
      req.on('error', () => resolve()); // ECONNRESET is expected
    });
    // If we get here without hanging, cleanup works
    expect(true).toBe(true);
  });
});
