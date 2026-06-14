import { describe, expect, it } from 'vitest';
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, relative } from 'node:path';
import { checkVisualBaseline } from '../scripts/homebase-visual-baseline.mjs';
import { validateMobileProof } from '../scripts/homebase-mobile-proof.mjs';

const visualContracts = {
  topStoryVisible: true,
  storySpecific: true,
  actionVisible: true,
  phoneCopyBudgetOk: true,
  reviewVisibleWhenWarning: true,
  affectedZoneMarked: true,
  healthyEvidenceCollapsed: true,
  activeIncidentMetadata: true,
  quietEvidence: true,
  evidenceBelowDecision: true,
  recentChangesGrouped: true,
  firstViewportFreeOfRawTelemetry: true
};

function screenshot(name, width, height, deviceScaleFactor = 1, orientation = 'portrait') {
  return {
    name,
    width,
    height,
    deviceScaleFactor,
    orientation,
    imageWidth: Math.round(width * deviceScaleFactor),
    imageHeight: Math.round(height * deviceScaleFactor),
    scrollWidth: width,
    firstScreenTextLength: name === 'desktop-4k' ? 1900 : 650,
    summaryTitle: 'Something needs a look.',
    summaryCopy: 'Check public access first.',
    firstZone: 'Public access',
    firstDecision: 'Check public access first.',
    nowDecision: 'Check public access first.',
    frozenHealth: true,
    visualContract: visualContracts
  };
}

describe('Homebase proof gates', () => {
  it('requires 4K and Retina visual baseline lanes', () => {
    const baseline = {
      requiredFields: ['summaryTitle', 'summaryCopy', 'firstZone', 'firstDecision', 'nowDecision', 'orientation', 'imageWidth', 'imageHeight', 'frozenHealth'],
      requiredVisualContracts: Object.keys(visualContracts),
      viewports: {
        phone: { width: 390, height: 844, deviceScaleFactor: 1, orientation: 'portrait', maxFirstScreenTextLength: 700, maxScrollOverrun: 1 },
        'phone-landscape': { width: 844, height: 390, deviceScaleFactor: 1, orientation: 'landscape', maxFirstScreenTextLength: 700, maxScrollOverrun: 1 },
        ipad: { width: 820, height: 1180, deviceScaleFactor: 1, orientation: 'portrait', maxFirstScreenTextLength: 1300, maxScrollOverrun: 1 },
        desktop: { width: 1440, height: 1000, deviceScaleFactor: 1, orientation: 'landscape', maxFirstScreenTextLength: 1300, maxScrollOverrun: 1 },
        'desktop-4k': { width: 3840, height: 2160, deviceScaleFactor: 1, orientation: 'landscape', maxFirstScreenTextLength: 2400, maxScrollOverrun: 1 },
        retina: { width: 1440, height: 1000, deviceScaleFactor: 2, orientation: 'landscape', maxFirstScreenTextLength: 1300, maxScrollOverrun: 1 }
      }
    };
    const report = {
      local: {
        screenshots: {
          outputs: [
            screenshot('phone', 390, 844, 1, 'portrait'),
            screenshot('phone-landscape', 844, 390, 1, 'landscape'),
            screenshot('ipad', 820, 1180, 1, 'portrait'),
            screenshot('desktop', 1440, 1000, 1, 'landscape'),
            screenshot('desktop-4k', 3840, 2160, 1, 'landscape'),
            screenshot('retina', 1440, 1000, 2, 'landscape')
          ]
        }
      }
    };

    expect(checkVisualBaseline(report, baseline)).toEqual(expect.objectContaining({
      status: 'ok'
    }));

    const drifted = structuredClone(report);
    drifted.local.screenshots.outputs.find(item => item.name === 'retina').deviceScaleFactor = 1;
    expect(checkVisualBaseline(drifted, baseline).detail).toContain('retina: viewport drifted 1440x1000@1, expected 1440x1000@2');

    const rotated = structuredClone(report);
    rotated.local.screenshots.outputs.find(item => item.name === 'phone-landscape').orientation = 'portrait';
    expect(checkVisualBaseline(rotated, baseline).detail).toContain('phone-landscape: orientation drifted portrait, expected landscape');

    const fakePng = structuredClone(report);
    fakePng.local.screenshots.outputs.find(item => item.name === 'retina').imageWidth = 1440;
    expect(checkVisualBaseline(fakePng, baseline).detail).toContain('retina: PNG dimensions drifted 1440x2000, expected 2880x2000');
  });

  it('requires Android Chrome proof to include a real screenshot and viewport metadata', () => {
    const dir = mkdtempSync(join(tmpdir(), 'homebase-android-proof-'));
    const screenshotPath = join(dir, 'android.png');
    writeFileSync(screenshotPath, 'png-proof');
    const proof = {
      version: 1,
      capturedAt: new Date().toISOString(),
      publicUrl: 'https://openclaw-mac-mini.tail02a3b6.ts.net:10000/pages/teddy-house/',
      devices: [
        {
          id: 'android-chrome',
          status: 'ok',
          loginPersisted: true,
          firstAction: 'Check public access first.',
          askUsable: false,
          fallbackVisible: true,
          noOverflow: true,
          rawTelemetryHidden: true,
          screenshot: relative(process.cwd(), screenshotPath),
          viewport: { width: 1080, height: 2340, cssWidth: 384, cssHeight: 832, densityDpi: 450, dpr: 2.8125 }
        },
        { id: 'iphone-pwa', status: 'ok', loginPersisted: true, firstAction: 'Check public access first.', askUsable: true, noOverflow: true, rawTelemetryHidden: true, screenshot: relative(process.cwd(), screenshotPath) },
        { id: 'ipad-pwa', status: 'ok', loginPersisted: true, firstAction: 'Check public access first.', askUsable: true, noOverflow: true, rawTelemetryHidden: true, screenshot: relative(process.cwd(), screenshotPath) }
      ]
    };

    expect(validateMobileProof(proof).status).toBe('ok');

    proof.devices[0].viewport = null;
    const broken = validateMobileProof(proof);
    expect(broken.status).toBe('partial');
    expect(broken.detail).toContain('android-chrome: Android viewport missing');
  });
});
