import { describe, expect, it } from 'vitest';
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { gauntletStatus } from '../scripts/homebase-dan-trust-gauntlet.mjs';

const requiredGates = [
  'replay-contracts',
  'story-agreement',
  'visual-contracts',
  'visual-baseline',
  'public-auth',
  'loopback-probe-boundary',
  'source-contracts',
  'parser-golden-fixtures',
  'copy-quality-coverage',
  'truth-verdict'
];

function writeJson(file, value) {
  writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`);
}

function tempReport(value) {
  const dir = mkdtempSync(join(tmpdir(), 'homebase-gauntlet-'));
  const file = join(dir, 'homebase-latest.json');
  mkdirSync(dir, { recursive: true });
  writeJson(file, value);
  return file;
}

function report(overrides = {}) {
  return {
    status: 'ok',
    acceptanceStatus: 'ok',
    publicAuth: 'enforced',
    truthVerdict: {
      label: 'Homebase needs Dan',
      firstAction: 'Check automations first.',
      publicAuth: 'enforced'
    },
    acceptanceGates: requiredGates.map(name => ({ name, status: 'ok' })),
    trustChecks: [],
    ...overrides
  };
}

const okLiveTeddy = {
  status: 'ok',
  detail: 'Live Teddy answered "Check automations first."',
  source: 'teddy',
  firstAction: 'Check automations first.'
};

const okMobile = {
  status: 'ok',
  detail: 'android-chrome:Check automations first., iphone-pwa:Check automations first., ipad-pwa:Check automations first.'
};

describe('Homebase Dan trust gauntlet', () => {
  it('fails when the latest QA report is missing', () => {
    const result = gauntletStatus('/private/tmp/homebase-missing-report.json', {
      liveTeddy: okLiveTeddy,
      mobile: okMobile
    });

    expect(result.status).toBe('fail');
    expect(result.failures.join(' ')).toContain('No latest Homebase QA report');
  });

  it('stays partial when QA is ok but real-world proof artifacts are missing', () => {
    const file = tempReport(report());
    const result = gauntletStatus(file, {
      liveTeddy: { status: 'partial', detail: 'No live Teddy proof artifact found' },
      mobile: { status: 'partial', detail: 'No real-device proof artifact found' }
    });

    expect(result.status).toBe('partial');
    expect(result.failures).toEqual([]);
    expect(result.partials).toEqual([
      'Live Teddy bridge proof: No live Teddy proof artifact found',
      'Real-device saved login proof: No real-device proof artifact found'
    ]);
  });

  it('passes only when QA, live Teddy proof, and real-device proof are ok', () => {
    const file = tempReport(report({ truthVerdict: { label: 'Homebase is useful', firstAction: 'Nothing needs Dan.', publicAuth: 'enforced' } }));
    const result = gauntletStatus(file, {
      liveTeddy: okLiveTeddy,
      mobile: okMobile
    });

    expect(result.status).toBe('ok');
    expect(result.detail).toContain('all current');
    expect(result.publicAuth).toBe('enforced');
  });

  it('fails when a required trust gate breaks even if proof artifacts are ok', () => {
    const gates = requiredGates.map(name => ({ name, status: name === 'visual-baseline' ? 'fail' : 'ok' }));
    const file = tempReport(report({ acceptanceGates: gates }));
    const result = gauntletStatus(file, {
      liveTeddy: okLiveTeddy,
      mobile: okMobile
    });

    expect(result.status).toBe('fail');
    expect(result.failures).toContain('visual-baseline is fail');
  });
});
