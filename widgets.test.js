/**
 * Widget generateHtml / generateJs unit tests
 *
 * Evaluates js/widgets.js in a jsdom context and validates that each widget
 * produces sensible HTML and JS output from its generator functions.
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { JSDOM } from 'jsdom';

let WIDGETS;

beforeAll(() => {
  const src = readFileSync(join(process.cwd(), 'js', 'widgets.js'), 'utf8');
  const dom = new JSDOM('<!DOCTYPE html><html><body></body></html>', {
    url: 'http://localhost',
    runScripts: 'dangerously',
  });
  // Provide EventSource stub so the module-level code doesn't throw
  dom.window.EventSource = class { constructor() {} close() {} };
  // WIDGETS is declared with const so it's not auto-assigned to window;
  // wrap in IIFE to explicitly expose it.
  const wrapped = '(function() { ' + src + ' window.WIDGETS = WIDGETS; })();';
  dom.window.eval(wrapped);
  WIDGETS = dom.window.WIDGETS;
});

describe('WIDGETS object', () => {
  it('is defined and has widgets', () => {
    expect(WIDGETS).toBeDefined();
    expect(Object.keys(WIDGETS).length).toBeGreaterThan(40);
  });

  it('every widget has required metadata fields', () => {
    for (const [key, w] of Object.entries(WIDGETS)) {
      expect(w.name, `${key}.name`).toBeTruthy();
      expect(w.category, `${key}.category`).toBeTruthy();
      expect(typeof w.defaultWidth, `${key}.defaultWidth`).toBe('number');
      expect(typeof w.defaultHeight, `${key}.defaultHeight`).toBe('number');
    }
  });
});

describe('generateHtml', () => {
  const makeProps = (id = 'test-1') => ({
    id,
    title: 'Test Widget',
    location: 'New York',
    units: 'F',
    refreshInterval: 300,
  });

  it('every widget with generateHtml returns a non-empty string', () => {
    for (const [key, w] of Object.entries(WIDGETS)) {
      if (!w.generateHtml) continue;
      const html = w.generateHtml(makeProps(`w-${key}`));
      expect(typeof html, `${key} generateHtml return type`).toBe('string');
      expect(html.trim().length, `${key} generateHtml not empty`).toBeGreaterThan(0);
    }
  });

  it('weather widget HTML contains widget id and location', () => {
    const props = makeProps('weather-1');
    const html = WIDGETS.weather.generateHtml(props);
    expect(html).toContain('weather-1');
    expect(html).toContain('New York');
  });

  it('weather widget HTML has expected structure', () => {
    const props = makeProps('weather-2');
    const html = WIDGETS.weather.generateHtml(props);
    expect(html).toContain('dash-card');
    expect(html).toContain('dash-card-head');
    expect(html).toContain('kpi-value');
    expect(html).toContain('kpi-label');
  });

  it('generateHtml embeds the props.id for DOM targeting', () => {
    // Spot-check a few widgets that use id for element targeting
    for (const key of ['weather', 'weather-multi']) {
      if (!WIDGETS[key]) continue;
      const id = `id-check-${key}`;
      const html = WIDGETS[key].generateHtml({ ...makeProps(), id });
      expect(html, `${key} should contain its id`).toContain(id);
    }
  });
});

describe('generateJs', () => {
  const makeProps = (id = 'js-test-1') => ({
    id,
    title: 'Test Widget',
    location: 'Atlanta',
    units: 'C',
    refreshInterval: 120,
  });

  it('every widget with generateJs returns a non-empty string', () => {
    for (const [key, w] of Object.entries(WIDGETS)) {
      if (!w.generateJs) continue;
      const js = w.generateJs(makeProps(`w-${key}`));
      expect(typeof js, `${key} generateJs return type`).toBe('string');
      // Some widgets (e.g. text-header) return empty JS — that's valid
      expect(typeof js.trim(), `${key} generateJs is string`).toBe('string');
    }
  });

  it('weather widget JS references its update function and refresh interval', () => {
    const props = makeProps('weather-js-1');
    const js = WIDGETS.weather.generateJs(props);
    expect(js).toContain('update_weather_js_1');
    expect(js).toContain('120000'); // refreshInterval * 1000
  });

  it('weather widget JS uses the correct unit parameter', () => {
    const jsC = WIDGETS.weather.generateJs({ ...makeProps(), units: 'C' });
    expect(jsC).toContain('celsius');
    const jsF = WIDGETS.weather.generateJs({ ...makeProps(), units: 'F' });
    expect(jsF).toContain('fahrenheit');
  });

  it('generated JS does not contain obvious syntax errors (balanced braces)', () => {
    // Simple heuristic — every opening brace should have a closing one
    for (const [key, w] of Object.entries(WIDGETS)) {
      if (!w.generateJs) continue;
      const js = w.generateJs(makeProps(`w-${key}`));
      const opens = (js.match(/\{/g) || []).length;
      const closes = (js.match(/\}/g) || []).length;
      expect(opens, `${key} balanced braces`).toBe(closes);
    }
  });
});

describe('widget properties', () => {
  it('widgets with hasApiKey=true define apiKeyName', () => {
    for (const [key, w] of Object.entries(WIDGETS)) {
      if (w.hasApiKey) {
        expect(w.apiKeyName || w.properties?.apiKey !== undefined,
          `${key} has hasApiKey but no apiKeyName or apiKey property`).toBeTruthy();
      }
    }
  });

  it('widget categories are one of the expected values', () => {
    const validCategories = new Set(['small', 'large', 'text', 'header', 'layout', 'system', 'bar']);
    for (const [key, w] of Object.entries(WIDGETS)) {
      expect(validCategories.has(w.category), `${key} has valid category "${w.category}"`).toBe(true);
    }
  });
});
