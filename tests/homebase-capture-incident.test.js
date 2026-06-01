import { describe, expect, it } from 'vitest';
import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

function writeJson(file, value) {
  writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`);
}

describe('Homebase incident capture', () => {
  it('writes a redacted draft bundle from persisted evidence', () => {
    const cwd = mkdtempSync(join(tmpdir(), 'homebase-capture-'));
    const dataDir = join(cwd, 'data', 'teddy-house');
    const qaDir = join(cwd, 'artifacts', 'qa');
    mkdirSync(dataDir, { recursive: true });
    mkdirSync(qaDir, { recursive: true });

    writeJson(join(qaDir, 'homebase-latest.json'), {
      generatedAt: '2026-06-01T06:21:40.093Z',
      truthVerdict: {
        label: 'Homebase needs Dan',
        firstZone: 'smart-home',
        firstAction: 'Check automations first.'
      },
      local: {
        headline: 'Homebase found an issue.',
        firstZone: 'smart-home',
        firstDecision: 'Check automations first.',
        screenshots: {
          outputs: [
            { firstReview: 'Automation logs: Govee connection degraded' }
          ]
        }
      }
    });
    writeJson(join(dataDir, 'snapshot.json'), {
      score: 78,
      homebridgeLogState: 'warn',
      serviceLogValue: 'Govee connection degraded',
      systemLogMetric: '0',
      funnelMetric: '8443, 10000'
    });
    writeJson(join(dataDir, 'service-logs.json'), {
      value: 'Govee connection degraded',
      detail: 'Govee connection degraded in the recent Homebridge log window.',
      items: [
        {
          name: 'Homebridge',
          detail: 'Govee is noisy',
          examples: [
            '[5/31/2026, 11:17:23 PM] [Govee] sync failed from 192.168.7.10 for dan@example.com on openclaw-mac-mini.tail02a3b6.ts.net'
          ]
        }
      ]
    });
    writeJson(join(dataDir, 'system-logs.json'), {
      metric: '0',
      detail: 'No recent panic diagnostics.'
    });
    writeJson(join(dataDir, 'timeline.json'), {
      events: [
        { title: 'Status check', detail: 'Readiness 78; no changes.' }
      ]
    });
    writeJson(join(dataDir, 'visual-evidence.json'), {
      entries: [
        { visuals: { houseState: {}, dailyDecision: {}, serviceGrid: {} } }
      ]
    });

    const result = spawnSync(process.execPath, [
      join(process.cwd(), 'scripts', 'homebase-capture-incident.mjs'),
      '--title',
      'Govee loop dan@example.com',
      '--fixture',
      'govee-loop'
    ], {
      cwd,
      encoding: 'utf8'
    });

    expect(result.status).toBe(0);
    const output = JSON.parse(result.stdout);
    expect(output.status).toBe('ok');
    expect(output.outputFile).toContain('data/teddy-house/qa/incident-drafts/');

    const bundle = JSON.parse(readFileSync(output.outputFile, 'utf8'));
    const bundleText = JSON.stringify(bundle);
    expect(bundle.status).toBe('draft');
    expect(bundle.id).toContain('email');
    expect(bundle.id).not.toContain('dan-example');
    expect(bundle.title).toBe('Govee loop [email]');
    expect(bundle.fixture).toBe('govee-loop');
    expect(bundle.expected).toEqual({
      headline: 'Homebase found an issue.',
      firstZone: 'smart-home',
      firstReview: 'Automation logs: Govee connection degraded',
      firstAction: 'Check automations first.'
    });
    expect(bundle.sourceSnapshots).toHaveLength(5);
    expect(bundle.sourceSnapshots.every(item => item.redacted === true)).toBe(true);
    expect(bundle.logExcerpts.every(item => item.redacted === true)).toBe(true);
    expect(bundle.logExcerpts[0].text).toContain('[5/31/2026, 11:17:23 PM]');
    expect(bundleText).not.toContain('dan@example.com');
    expect(bundleText).not.toContain('192.168.7.10');
    expect(bundleText).not.toContain('8443, 10000');
    expect(bundleText).not.toContain('openclaw-mac-mini.tail02a3b6.ts.net');
  });
});
