import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { startServer } from '../helpers/server.js';

let srv;

beforeAll(async () => {
  srv = await startServer();
});

afterAll(async () => { if (srv) await srv.kill(); });

describe('Orphaned custom pages', () => {
  it('stay out of the visible app', async () => {
    const res = await fetch(`${srv.baseUrl}/api/pages`);
    expect(res.status).toBe(200);
    const pages = await res.json();

    const ids = pages.map(page => page.id);
    expect(ids).not.toContain('claude-usage');
    expect(ids).not.toContain('focus-room');
  });

  it('does not serve disabled custom app pages or page APIs', async () => {
    const claudePageNoSlash = await fetch(`${srv.baseUrl}/pages/claude-usage`);
    const claudePage = await fetch(`${srv.baseUrl}/pages/claude-usage/`);
    const claudeApi = await fetch(`${srv.baseUrl}/api/pages/claude-usage/usage`);
    const focusPageNoSlash = await fetch(`${srv.baseUrl}/pages/focus-room`);
    const focusPage = await fetch(`${srv.baseUrl}/pages/focus-room/`);
    const focusAsset = await fetch(`${srv.baseUrl}/pages/focus-room/teddy-focus-room-preview.mp4`);

    expect(claudePageNoSlash.status).toBe(404);
    expect(claudePage.status).toBe(404);
    expect(claudeApi.status).toBe(404);
    expect(focusPageNoSlash.status).toBe(404);
    expect(focusPage.status).toBe(404);
    expect(focusAsset.status).toBe(404);
  });
});
