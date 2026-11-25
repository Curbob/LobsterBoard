/**
 * Tests for _normalizeRemoteStats() in js/widgets/shared/stats.js —
 * maps lobsterboard-agent payloads to the local SSE stats shape.
 */

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

// Both copies define _normalizeRemoteStats as a top-level function:
// js/widgets/shared/stats.js (loaded by app.html) and the legacy js/widgets.js.
function loadNormalizer(file) {
  const src = readFileSync(join(process.cwd(), file), 'utf8');
  const fakeWindow = {};
  return new Function('window', 'document', 'module', src + '\nreturn _normalizeRemoteStats;')(
    fakeWindow, undefined, undefined,
  );
}

for (const file of ['js/widgets/shared/stats.js', 'js/widgets.js']) {
describe(`_normalizeRemoteStats disk (${file})`, () => {
  const _normalizeRemoteStats = loadNormalizer(file);

  it('maps agent disk.percent to use so the Disk Usage ring is not 0% (#29)', () => {
    const out = _normalizeRemoteStats({
      disk: { mount: '/', total: 500e9, used: 210e9, percent: 42 },
    });
    expect(out.disk).toEqual([{ mount: '/', size: 500e9, used: 210e9, use: 42 }]);
  });

  it('computes use from used/total when percent is missing', () => {
    const out = _normalizeRemoteStats({ disk: { total: 200, used: 50 } });
    expect(out.disk[0].use).toBe(25);
  });

  it('keeps a real 0% from the agent', () => {
    const out = _normalizeRemoteStats({ disk: { total: 200, used: 50, percent: 0 } });
    expect(out.disk[0].use).toBe(0);
  });

  it('returns 0 when total is missing', () => {
    const out = _normalizeRemoteStats({ disk: { used: 50 } });
    expect(out.disk[0].use).toBe(0);
  });

  it('returns null disk when the agent sends none', () => {
    expect(_normalizeRemoteStats({}).disk).toBeNull();
  });
});
}
