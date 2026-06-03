import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { liveTeddyProofStatus } from './homebase-live-teddy-proof.mjs';
import { mobileProofStatus } from './homebase-mobile-proof.mjs';

const reportPath = process.env.HOMEBASE_QA_REPORT_FILE
  || join(process.cwd(), 'artifacts', 'qa', 'homebase-latest.json');

const requiredQaGates = [
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

function readReport(path = reportPath) {
  if (!existsSync(path)) return null;
  try {
    return JSON.parse(readFileSync(path, 'utf8'));
  } catch {
    return null;
  }
}

function statusFor(report, name) {
  const all = [
    ...(Array.isArray(report?.acceptanceGates) ? report.acceptanceGates : []),
    ...(Array.isArray(report?.trustChecks) ? report.trustChecks : [])
  ];
  return all.find(item => item.name === name)?.status || 'missing';
}

function okStatus(status) {
  return status === 'ok';
}

function gauntletStatus(path = reportPath, proof = {}) {
  const report = readReport(path);
  const liveTeddy = proof.liveTeddy || liveTeddyProofStatus();
  const mobile = proof.mobile || mobileProofStatus();
  const failures = [];
  const partials = [];

  if (!report) {
    failures.push(`No latest Homebase QA report found at ${path}`);
  } else {
    if (report.status !== 'ok') failures.push(`QA status is ${report.status || 'missing'}`);
    if (report.acceptanceStatus !== 'ok') failures.push(`acceptance status is ${report.acceptanceStatus || 'missing'}`);
    const publicAuth = report.publicAuth || report.truthVerdict?.publicAuth;
    if (publicAuth !== 'enforced') failures.push(`public auth is ${publicAuth || 'missing'}`);
    if (report.truthVerdict?.label === 'Homebase is lying') failures.push('truth verdict says Homebase is lying');
    for (const gate of requiredQaGates) {
      const gateStatus = statusFor(report, gate);
      if (gateStatus !== 'ok') failures.push(`${gate} is ${gateStatus}`);
    }
  }

  if (!okStatus(liveTeddy.status)) partials.push(`Live Teddy bridge proof: ${liveTeddy.detail}`);
  if (!okStatus(mobile.status)) partials.push(`Real-device saved login proof: ${mobile.detail}`);

  const status = failures.length > 0 ? 'fail' : partials.length > 0 ? 'partial' : 'ok';
  const firstAction = report?.truthVerdict?.firstAction || report?.local?.firstDecision || null;
  const verdict = report?.truthVerdict?.label || 'Homebase QA missing';
  return {
    status,
    verdict,
    firstAction,
    publicAuth: report?.publicAuth || report?.truthVerdict?.publicAuth || 'unknown',
    reportPath: path,
    liveTeddy,
    mobile,
    failures,
    partials,
    detail: failures.length > 0
      ? failures.join('; ')
      : partials.length > 0
      ? partials.join('; ')
      : 'QA, live Teddy bridge proof, and real-device saved-login proof are all current.'
  };
}

function printGauntlet(result) {
  console.log(`Homebase Dan trust gauntlet: ${result.status}`);
  console.log(`Verdict: ${result.verdict}`);
  console.log(`First action: ${result.firstAction || 'unknown'}`);
  console.log(`Public auth: ${result.publicAuth}`);
  if (result.failures.length > 0) {
    console.log('Failures:');
    for (const item of result.failures) console.log(`- ${item}`);
  }
  if (result.partials.length > 0) {
    console.log('Still partial:');
    for (const item of result.partials) console.log(`- ${item}`);
  }
  if (result.status === 'ok') console.log(result.detail);
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const result = gauntletStatus();
  printGauntlet(result);
  if (result.status !== 'ok' && process.env.HOMEBASE_REQUIRE_DAN_TRUST_GAUNTLET === '1') process.exit(1);
}

export { gauntletStatus };
