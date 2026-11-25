/**
 * Claude Usage week-progress meter (all three widget copies) and the
 * OpenClaw version parsing used by /api/releases.
 */

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { createRequire } from 'node:module';
import { JSDOM } from 'jsdom';

const require = createRequire(import.meta.url);
const { parseOpenclawVersion } = require('../server/routes/system.cjs');

const DAY = 86400000;

// Usage data whose 7-day window resets in `daysLeft` days with `used`% of the weekly limit used.
function usage(daysLeft, used) {
  return {
    subscription: 'max',
    five_hour: { utilization: 10, resets_at: new Date(Date.now() + 3600000).toISOString() },
    seven_day: { utilization: used, resets_at: new Date(Date.now() + daysLeft * DAY).toISOString() },
  };
}

function newDom() {
  const dom = new JSDOM('<!DOCTYPE html><body><div id="t-sub"></div><div id="t-body"></div></body>', { url: 'http://localhost', runScripts: 'dangerously' });
  dom.window.EventSource = class { close() {} };
  dom.window.setInterval = () => 0;
  return dom;
}

// Run a widget's generated script against fake /usage data and return the rendered body.
async function render(dom, js, data) {
  dom.window.fetch = async () => ({ json: async () => data });
  dom.window.eval('(async () => {' + js + '})()');
  for (let i = 0; i < 20 && !dom.window.document.querySelector('#t-body .lb-week-pace'); i++) {
    await new Promise(r => setTimeout(r, 10));
  }
  return dom.window.document.getElementById('t-body');
}

function loaders() {
  return {
    'app (js/widgets/*)': () => {
      const dom = newDom();
      for (const f of ['js/widgets/shared/icons.js', 'js/widgets/index.js', 'js/widgets/ai-tools.js']) {
        dom.window.eval(readFileSync(join(process.cwd(), f), 'utf8'));
      }
      return { dom, W: dom.window.WIDGETS };
    },
    'legacy js/widgets.js': () => {
      const dom = newDom();
      dom.window.eval('(function() { ' + readFileSync(join(process.cwd(), 'js', 'widgets.js'), 'utf8') + ' window.WIDGETS = WIDGETS; })();');
      return { dom, W: dom.window.WIDGETS };
    },
    'library src/widgets.js': async () => {
      const dom = newDom();
      const { WIDGETS } = await import('../src/widgets.js');
      return { dom, W: WIDGETS };
    },
  };
}

describe('Claude Usage week progress meter', () => {
  for (const [name, load] of Object.entries(loaders())) {
    describe(name, () => {
      const cases = [
        // [days left, % used, expected label]: halfway through the week is 50%
        [3.5, 20, 'Ahead of pace'],
        [3.5, 45, 'On track'],
        [3.5, 55, 'Slightly behind'],
        [3.5, 80, 'Behind pace'],
      ];
      for (const [daysLeft, used, label] of cases) {
        it(`${used}% used halfway through the week -> ${label}`, async () => {
          const { dom, W } = await load();
          const body = await render(dom, W['claude-usage'].generateJs({ id: 't', refreshInterval: 120 }), usage(daysLeft, used));
          const meter = body.querySelector('.lb-week-pace');
          expect(meter, 'week meter rendered').not.toBeNull();
          expect(meter.querySelector('.lb-week-status').textContent).toContain(label);
          expect(meter.textContent).toMatch(/50% of week · \d+% used/);
          expect(meter.textContent).toContain('resets ');
          // the usual bars are still there
          expect(body.textContent).toContain('5h Session');
        });
      }

      it('shows no week meter without a weekly reset time', async () => {
        const { dom, W } = await load();
        const data = usage(3, 10);
        delete data.seven_day.resets_at;
        const body = await render(dom, W['claude-usage'].generateJs({ id: 't', refreshInterval: 120 }), data);
        expect(body.querySelector('.lb-week-pace')).toBeNull();
        expect(body.textContent).toContain('7d Weekly');
      });
    });
  }
});

describe('OpenClaw version parsing', () => {
  it('pulls the version out of `openclaw --version`', () => {
    expect(parseOpenclawVersion('OpenClaw 2026.3.23-2 (a1b2c3d)\n')).toBe('2026.3.23-2');
    expect(parseOpenclawVersion('2026.11.4')).toBe('2026.11.4');
  });

  it('returns null for output without a version, so the server falls back to package.json', () => {
    expect(parseOpenclawVersion('OpenClaw (dev build)')).toBeNull();
    expect(parseOpenclawVersion('')).toBeNull();
    expect(parseOpenclawVersion(undefined)).toBeNull();
  });
});
