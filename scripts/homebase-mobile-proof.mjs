import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

const proofPath = process.env.HOMEBASE_MOBILE_PROOF_FILE
  || join(process.cwd(), 'artifacts', 'qa', 'homebase-mobile-proof-latest.json');
const requiredDevices = ['android-chrome', 'iphone-pwa', 'ipad-pwa'];
const maxAgeDays = Number.parseInt(process.env.HOMEBASE_MOBILE_PROOF_MAX_AGE_DAYS || '45', 10);

function readJson(path) {
  return JSON.parse(readFileSync(path, 'utf8'));
}

function ageDays(iso) {
  const time = Date.parse(iso || '');
  if (!Number.isFinite(time)) return Infinity;
  return (Date.now() - time) / 86400000;
}

function validateMobileProof(proof, path = proofPath) {
  const failures = [];
  if (!proof || typeof proof !== 'object') failures.push('proof object missing');
  if (proof?.version !== 1) failures.push('version must be 1');
  if (proof?.publicUrl !== 'https://openclaw-mac-mini.tail02a3b6.ts.net:10000/pages/teddy-house/') {
    failures.push('publicUrl must be the approved Homebase Funnel route');
  }
  if (!proof?.capturedAt || !Number.isFinite(Date.parse(proof.capturedAt))) failures.push('capturedAt must be an ISO timestamp');
  if (ageDays(proof?.capturedAt) > maxAgeDays) failures.push(`proof is older than ${maxAgeDays} days`);
  const devices = Array.isArray(proof?.devices) ? proof.devices : [];
  const byId = new Map(devices.map(device => [device.id, device]));
  const missing = requiredDevices.filter(id => !byId.has(id));
  for (const id of missing) failures.push(`${id} proof missing`);
  const items = requiredDevices.map(id => {
    const device = byId.get(id);
    if (!device) return { id, status: 'missing' };
    const deviceFailures = [];
    if (device.status !== 'ok') deviceFailures.push(`status ${device.status || 'missing'}`);
    if (device.loginPersisted !== true) deviceFailures.push('login persistence not proved');
    if (typeof device.firstAction !== 'string' || device.firstAction.length === 0) deviceFailures.push('first action missing');
    if (device.noOverflow !== true) deviceFailures.push('overflow not cleared');
    if (!(device.askUsable === true || device.fallbackVisible === true)) deviceFailures.push('Ask Teddy/fallback not proved');
    if (device.rawTelemetryHidden !== true) deviceFailures.push('raw telemetry not proved hidden');
    if (deviceFailures.length > 0) failures.push(`${id}: ${deviceFailures.join(', ')}`);
    return {
      id,
      status: deviceFailures.length === 0 ? 'ok' : 'fail',
      firstAction: device.firstAction || null
    };
  });
  return {
    status: failures.length === 0 ? 'ok' : 'partial',
    detail: failures.length === 0
      ? items.map(item => `${item.id}:${item.firstAction}`).join(', ')
      : failures.join('; '),
    proofPath: path,
    items
  };
}

function mobileProofStatus(path = proofPath) {
  if (!existsSync(path)) {
    return {
      status: 'partial',
      detail: `No real-device proof artifact found at ${path}`,
      proofPath: path,
      items: requiredDevices.map(id => ({ id, status: 'missing' }))
    };
  }
  return validateMobileProof(readJson(path), path);
}

function printTemplate() {
  console.log(JSON.stringify({
    version: 1,
    capturedAt: new Date().toISOString(),
    publicUrl: 'https://openclaw-mac-mini.tail02a3b6.ts.net:10000/pages/teddy-house/',
    devices: requiredDevices.map(id => ({
      id,
      label: id === 'android-chrome' ? 'Android Chrome' : id === 'iphone-pwa' ? 'iPhone Home Screen PWA' : 'iPad Home Screen PWA',
      status: 'ok',
      loginPersisted: true,
      firstAction: 'Check automations first.',
      askUsable: true,
      fallbackVisible: false,
      noOverflow: true,
      rawTelemetryHidden: true,
      screenshot: 'artifacts/qa/mobile/device-proof.png',
      notes: 'Replace with real device observation.'
    }))
  }, null, 2));
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  if (process.argv.includes('--template')) {
    printTemplate();
  } else {
    const result = mobileProofStatus();
    console.log(`Homebase mobile proof: ${result.status}`);
    console.log(result.detail);
    if (result.status !== 'ok' && process.env.HOMEBASE_REQUIRE_MOBILE_PROOF === '1') process.exit(1);
  }
}

export { mobileProofStatus, validateMobileProof };
