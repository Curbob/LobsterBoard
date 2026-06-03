import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const reportPath = join(process.cwd(), 'artifacts', 'qa', 'homebase-latest.json');

function readReport() {
  if (!existsSync(reportPath)) return null;
  try {
    return JSON.parse(readFileSync(reportPath, 'utf8'));
  } catch {
    return null;
  }
}

function findStatus(items, name) {
  const item = Array.isArray(items) ? items.find(entry => entry.name === name) : null;
  return item ? item.status || 'unknown' : 'missing';
}

function proof(report, name) {
  return findStatus(report?.acceptanceGates, name) === 'ok'
    || findStatus(report?.trustChecks, name) === 'ok';
}

function line(item) {
  const status = item.status.padEnd(7, ' ');
  return `${status} ${item.name} - ${item.detail}`;
}

const report = readReport();
const askSource = report?.local?.ask?.source || 'unknown';
const askAgentMode = report?.local?.ask?.agentMode || 'unknown';
const screenshots = report?.local?.screenshots?.outputs || [];

const need = [
  {
    name: 'Live Teddy bridge contract',
    status: askSource === 'teddy' ? 'ok' : askAgentMode === 'enabled' ? 'gap' : 'partial',
    detail: askSource === 'teddy'
      ? 'Ask Teddy proved the live bridge path.'
      : askAgentMode === 'enabled'
        ? `Live bridge was enabled, but latest Ask source is ${askSource}; fallback honesty is covered and the bridge needs debugging.`
        : `Latest Ask source is ${askSource} with ${askAgentMode} mode; fast local answers are expected, and live bridge proof remains an opt-in gate.`
  },
  {
    name: 'Real-device saved login',
    status: proof(report, 'login-persistence') ? 'partial' : 'gap',
    detail: proof(report, 'login-persistence')
      ? 'Isolated browser login persistence is automated; Android/iPhone/iPad relaunch proof remains manual after auth changes.'
      : 'No cached-login proof found in the latest QA report.'
  },
  {
    name: 'Incident ranking golden pack',
    status: proof(report, 'replay-story-agreement') && proof(report, 'zone-ranking-coverage') ? 'ok' : 'gap',
    detail: 'Curated fixtures must prove Mac restart, Homebridge, public access, network, and bridge incidents rank correctly.'
  },
  {
    name: 'First-screen slop blacklist',
    status: proof(report, 'copy-quality-coverage') && proof(report, 'visual-contracts') ? 'ok' : 'gap',
    detail: 'Raw ports, package counts, unexplained degraded labels, and generic service copy stay off the daily surface.'
  },
  {
    name: 'Source freshness and trust',
    status: proof(report, 'source-contracts') ? 'ok' : 'gap',
    detail: 'First-screen signals need source, freshness, confidence, and trusted/degraded/ignored/needs-login state.'
  }
];

const want = [
  {
    name: 'Visual baseline regression',
    status: proof(report, 'visual-baseline') ? 'ok' : screenshots.length >= 3 ? 'partial' : 'gap',
    detail: proof(report, 'visual-baseline')
      ? 'Phone, iPad, and desktop screenshots passed the structural visual baseline.'
      : screenshots.length >= 3
      ? 'Phone, iPad, and desktop screenshots are captured; structural baseline proof is still missing.'
      : 'Responsive screenshots were not captured in the latest QA report.'
  },
  {
    name: 'Timeline intelligence',
    status: proof(report, 'visual-contracts') ? 'ok' : 'gap',
    detail: 'Repeated events should collapse into one useful change, not timestamp spam.'
  },
  {
    name: 'Action safety matrix',
    status: proof(report, 'ask-action-safety') && proof(report, 'incident-capture') ? 'ok' : 'gap',
    detail: 'Explain, prepare fix, mark known, open logs, and capture stay read-only or dry-run.'
  },
  {
    name: 'Public auth route matrix',
    status: proof(report, 'public-auth') && proof(report, 'loopback-probe-boundary') ? 'ok' : 'gap',
    detail: 'Public Tailscale stays passworded and loopback trust does not leak to remote-looking hosts.'
  },
  {
    name: 'Log parser fixture pack',
    status: proof(report, 'parser-golden-fixtures') ? 'ok' : 'gap',
    detail: 'Homebridge, Govee, Eufy, macOS diagnostics, Tailscale routes, timestamps, and AdGuard stats have parser proof.'
  }
];

const dream = [
  {
    name: 'Dan trust gauntlet',
    status: proof(report, 'replay-contracts') ? 'partial' : 'gap',
    detail: 'Twenty-plus messy house stories replay today; the dream is real-device replay plus structural visual baselines for every story.'
  }
];

console.log('Homebase test ladder');
console.log(report ? `Latest QA: ${report.status}/${report.acceptanceStatus}; public auth ${report.publicAuth || report.truthVerdict?.publicAuth || 'unknown'}` : 'Latest QA: missing; run npm run check:homebase first');
console.log('');
console.log('Need');
console.log(need.map(line).join('\n'));
console.log('');
console.log('Want');
console.log(want.map(line).join('\n'));
console.log('');
console.log('Dream');
console.log(dream.map(line).join('\n'));
