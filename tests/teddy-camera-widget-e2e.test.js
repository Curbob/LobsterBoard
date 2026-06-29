/**
 * End-to-end test for the Teddy Camera widget rendering.
 *
 * Simulates a browser context, renders the widget HTML+JS, mocks the
 * /api/teddy-camera/feed response, executes the JS, and asserts that the
 * user-facing message ("Amazon-looking delivery candidate. Verify the frame.")
 * is actually visible in the rendered DOM.
 */

import { describe, it, expect } from 'vitest';
import { JSDOM } from 'jsdom';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

function loadWidgetInDom() {
  const dom = new JSDOM('<!DOCTYPE html><html><body></body></html>', {
    url: 'http://localhost:8080',
    runScripts: 'dangerously',
    pretendToBeVisual: true,
  });
  dom.window.EventSource = class { constructor() {} close() {} };
  for (const m of [
    'js/widgets/shared/helpers.js',
    'js/widgets/shared/icons.js',
    'js/widgets/shared/stats.js',
  ]) {
    const src = readFileSync(join(process.cwd(), m), 'utf8');
    dom.window.eval(src);
  }
  const widgetSrc = readFileSync(join(process.cwd(), 'js', 'widgets', 'misc.js'), 'utf8');
  dom.window.eval(widgetSrc);
  return dom;
}

describe('Teddy Camera widget end-to-end', () => {
  it('renders the friendly delivery message in the DOM when feed returns a car detection', async () => {
    const dom = loadWidgetInDom();
    const widget = dom.window.WIDGETS['teddy-camera-events'];
    expect(widget, 'widget is registered').toBeDefined();

    const sampleFeed = {
      ok: true,
      source: 'teddy-camera',
      captured_at: '2026-06-28T23:25:24.156Z',
      last_updated: new Date().toISOString(),
      item_count: 1,
      items: [
        {
          id: 'semantic:delivery:2026-06-28T23:25:24.156Z',
          icon: '🚗',
          label: 'Car',
          message: '🚗 Car on camera just now.',
          verb: 'on camera',
          age_seconds: 5,
          captured_at: '2026-06-28T23:25:24.156Z',
          thumb_url: '/thumbs/sample.jpg',
          source: 'local-yolo-event',
          severity: 'watch',
          labels: ['car'],
          kind: 'delivery',
          soc: 'Delivery vehicle on approach. Flagged for follow-up clip. No plate logged.',
          teddy: 'A van pulled up, a van left. I did not get the brand, the contract says I do not.',
          hand_off: 'Delivery vehicle on approach. Flagged for follow-up clip. No plate logged.  //  A van pulled up, a van left. I did not get the brand, the contract says I do not.'
        }
      ]
    };
    dom.window.fetch = async () => ({ ok: true, status: 200, json: async () => sampleFeed });

    const props = { id: 'tc-1', title: 'Front Door', maxItems: 6, refreshInterval: 30, emptyState: 'Watching the front door.' };
    dom.window.document.body.innerHTML = widget.generateHtml(props);
    const js = widget.generateJs(props);
    new dom.window.Function(js)();
    await new Promise(r => setTimeout(r, 50));

    const listEl = dom.window.document.getElementById('tc-1-list');
    const statusEl = dom.window.document.getElementById('tc-1-status');
    const badgeEl = dom.window.document.getElementById('tc-1-badge');
    const html = listEl?.innerHTML || '';
    // New voice: GSOC line in the subline, teddy in the title attribute.
    expect(html, 'renders the car icon').toContain('🚗');
    expect(html, 'renders the GSOC line').toContain('No plate logged');
    expect(html, 'renders the message line').toContain('Car on camera just now.');
    // Old AI-slop copy should NOT appear.
    expect(html, 'rejects old AI-slop').not.toContain('Verify the frame');
    expect(html, 'rejects old AI-slop').not.toContain('Big trash energy');
    expect(statusEl?.textContent, 'status text mentions 1 recent').toMatch(/1 recent/);
    expect(badgeEl?.textContent, 'badge shows count').toBe('1');
    expect(badgeEl?.style?.display, 'badge visible when count > 0').not.toBe('none');
  });

  it('renders the empty state when the feed has no items', async () => {
    const dom = loadWidgetInDom();
    const widget = dom.window.WIDGETS['teddy-camera-events'];
    dom.window.fetch = async () => ({ ok: true, status: 200, json: async () => ({ ok: true, items: [], item_count: 0, last_updated: new Date().toISOString() }) });
    const props = { id: 'tc-2', title: 'Front Door', maxItems: 6, refreshInterval: 30, emptyState: 'Watching the front door.' };
    dom.window.document.body.innerHTML = widget.generateHtml(props);
    new dom.window.Function(widget.generateJs(props))();
    await new Promise(r => setTimeout(r, 50));
    const listEl = dom.window.document.getElementById('tc-2-list');
    expect(listEl?.innerHTML, 'shows empty state').toContain('Watching the front door.');
  });

  it('shows the camera-offline error when the feed returns ok: false', async () => {
    const dom = loadWidgetInDom();
    const widget = dom.window.WIDGETS['teddy-camera-events'];
    dom.window.fetch = async () => ({ ok: true, status: 200, json: async () => ({ ok: false, error: 'upstream timeout', items: [] }) });
    const props = { id: 'tc-3', title: 'Front Door', maxItems: 6, refreshInterval: 30, emptyState: 'Watching the front door.' };
    dom.window.document.body.innerHTML = widget.generateHtml(props);
    new dom.window.Function(widget.generateJs(props))();
    await new Promise(r => setTimeout(r, 50));
    const listEl = dom.window.document.getElementById('tc-3-list');
    const statusEl = dom.window.document.getElementById('tc-3-status');
    expect(listEl?.innerHTML, 'shows offline message').toContain('Camera offline');
    expect(statusEl?.textContent, 'status reflects offline').toContain('offline');
  });

  it('dims rows older than staleAfterSeconds and adds a live pulse to fresh feed', async () => {
    const dom = loadWidgetInDom();
    const widget = dom.window.WIDGETS['teddy-camera-events'];
    const now = new Date().toISOString();
    const feed = {
      ok: true,
      last_updated: now,
      items: [
        // Fresh: 30s old
        { id: 'fresh', message: '🚶 Person on camera.', icon: '🚶', label: 'Person', verb: 'on camera', age_seconds: 30, captured_at: now, labels: ['person'], kind: 'person', thumb_url: '/thumbs/a.jpg', soc: 'Fresh row.', teddy: 'Fresh teddy.' },
        // Stale: 600s old
        { id: 'stale', message: '🚗 Car on camera.', icon: '🚗', label: 'Car', verb: 'on camera', age_seconds: 600, captured_at: now, labels: ['car'], kind: 'vehicle', thumb_url: '/thumbs/b.jpg', soc: 'Stale row.', teddy: 'Stale teddy.' }
      ]
    };
    dom.window.fetch = async () => ({ ok: true, status: 200, json: async () => feed });
    const props = { id: 'tc-4', title: 'Front Door', maxItems: 6, refreshInterval: 30, emptyState: 'Watching.', staleAfterSeconds: 300 };
    dom.window.document.body.innerHTML = widget.generateHtml(props);
    new dom.window.Function(widget.generateJs(props))();
    await new Promise(r => setTimeout(r, 50));
    const listEl = dom.window.document.getElementById('tc-4-list');
    const statusEl = dom.window.document.getElementById('tc-4-status');
    const html = listEl?.innerHTML || '';
    expect(html, 'fresh row is not dimmed').not.toMatch(/<div class="teddycam-row teddycam-stale"[^>]*>[\s\S]*Fresh row/);
    expect(html, 'stale row is dimmed').toMatch(/<div class="teddycam-row teddycam-stale"[^>]*>[\s\S]*Stale row/);
    expect(statusEl?.innerHTML, 'pulse is active when feed is fresh').toContain('teddycam-pulse');
    expect(statusEl?.innerHTML, 'pulse is not dimmed when fresh').not.toContain('teddycam-pulse-dim');
  });

  it('dims the pulse and uses the empty state when the feed is empty', async () => {
    const dom = loadWidgetInDom();
    const widget = dom.window.WIDGETS['teddy-camera-events'];
    const feed = { ok: true, last_updated: new Date().toISOString(), items: [] };
    dom.window.fetch = async () => ({ ok: true, status: 200, json: async () => feed });
    const props = { id: 'tc-5', title: 'Front Door', maxItems: 6, refreshInterval: 30, emptyState: 'Quiet house, for now.' };
    dom.window.document.body.innerHTML = widget.generateHtml(props);
    new dom.window.Function(widget.generateJs(props))();
    await new Promise(r => setTimeout(r, 50));
    const listEl = dom.window.document.getElementById('tc-5-list');
    const statusEl = dom.window.document.getElementById('tc-5-status');
    const badgeEl = dom.window.document.getElementById('tc-5-badge');
    expect(listEl?.innerHTML, 'shows empty state').toContain('Quiet house, for now.');
    expect(badgeEl?.style?.display, 'badge hidden when no items').toBe('none');
    expect(statusEl?.innerHTML, 'pulse present even when empty').toContain('teddycam-pulse');
  });

  it('the badge carries a count + breakdown tooltip when there are items', async () => {
    const dom = loadWidgetInDom();
    const widget = dom.window.WIDGETS['teddy-camera-events'];
    const now = new Date().toISOString();
    const feed = {
      ok: true,
      last_updated: now,
      items: [
        { id: 'p1', message: '🚶 Person on camera.', icon: '🚶', label: 'Person', verb: 'on camera', age_seconds: 5, captured_at: now, labels: ['person'], kind: 'person', soc: 'soc1', teddy: 'teddy1' },
        { id: 'p2', message: '🚶 Person on camera.', icon: '🚶', label: 'Person', verb: 'on camera', age_seconds: 10, captured_at: now, labels: ['person'], kind: 'person', soc: 'soc2', teddy: 'teddy2' },
        { id: 'c1', message: '🚗 Car on camera.', icon: '🚗', label: 'Car', verb: 'on camera', age_seconds: 20, captured_at: now, labels: ['car'], kind: 'vehicle', soc: 'soc3', teddy: 'teddy3' }
      ]
    };
    dom.window.fetch = async () => ({ ok: true, status: 200, json: async () => feed });
    const props = { id: 'tc-6', title: 'Front Door', maxItems: 6, refreshInterval: 30, emptyState: 'Watching.' };
    dom.window.document.body.innerHTML = widget.generateHtml(props);
    new dom.window.Function(widget.generateJs(props))();
    await new Promise(r => setTimeout(r, 50));
    const badgeEl = dom.window.document.getElementById('tc-6-badge');
    expect(badgeEl?.textContent, 'badge count is 3').toBe('3');
    expect(badgeEl?.style?.display, 'badge visible').not.toBe('none');
    expect(badgeEl?.title, 'breakdown tooltip includes 2 person').toMatch(/2 person/);
    expect(badgeEl?.title, 'breakdown tooltip includes 1 vehicle').toMatch(/1 vehicle/);
  });
});
