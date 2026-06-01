import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const reportPath = join(process.cwd(), 'artifacts', 'qa', 'homebase-latest.json');

function fail(message) {
  console.error(`Homebase verdict unavailable: ${message}`);
  process.exit(1);
}

let report;
try {
  report = JSON.parse(readFileSync(reportPath, 'utf8'));
} catch (err) {
  fail(`${reportPath} could not be read. Run npm run check:homebase first.`);
}

const verdict = report.truthVerdict;
if (!verdict || typeof verdict.label !== 'string') {
  fail('truthVerdict is missing. Run npm run check:homebase with the current QA harness.');
}

const lines = [
  verdict.label,
  verdict.summary,
  verdict.firstAction ? `First action: ${verdict.firstAction}` : null,
  verdict.firstZone ? `First zone: ${verdict.firstZone}` : null,
  `Acceptance: ${report.acceptanceStatus || 'unknown'}`,
  `Public auth: ${verdict.publicAuth || report.publicAuth || 'unknown'}`
].filter(Boolean);

console.log(lines.join('\n'));

if (verdict.label === 'Homebase is lying') {
  process.exit(2);
}
