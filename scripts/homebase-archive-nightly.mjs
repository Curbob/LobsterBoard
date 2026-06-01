import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';

const maxEntries = Number.parseInt(process.env.HOMEBASE_NIGHTLY_HISTORY_LIMIT || '30', 10);
const limit = Number.isFinite(maxEntries) && maxEntries > 0 ? maxEntries : 30;
const qaDir = join(process.cwd(), 'artifacts', 'qa');
const reportPath = join(qaDir, 'homebase-latest.json');
const historyPath = join(qaDir, 'homebase-nightly-history.json');

function readJson(path, fallback) {
  try {
    return JSON.parse(readFileSync(path, 'utf8'));
  } catch {
    return fallback;
  }
}

const report = readJson(reportPath, null);
if (!report || !report.truthVerdict) {
  console.error('Homebase nightly archive unavailable: run npm run check:homebase first.');
  process.exit(1);
}

const existing = readJson(historyPath, []);
const history = Array.isArray(existing) ? existing : [];
const entry = {
  generatedAt: report.generatedAt || new Date().toISOString(),
  acceptanceStatus: report.acceptanceStatus || 'unknown',
  publicAuth: report.publicAuth || report.truthVerdict.publicAuth || 'unknown',
  verdict: report.truthVerdict.label,
  summary: report.truthVerdict.summary,
  firstAction: report.truthVerdict.firstAction || null,
  firstZone: report.truthVerdict.firstZone || null,
  reviewItems: report.local?.reviewItems ?? null,
  failedGates: report.truthVerdict.failedGates || [],
  failedChecks: report.truthVerdict.failedChecks || [],
  screenshotFiles: report.local?.screenshots?.outputs?.map(item => item.file).filter(Boolean) || []
};

const nextHistory = [...history, entry]
  .sort((a, b) => String(a.generatedAt).localeCompare(String(b.generatedAt)))
  .slice(-limit);

mkdirSync(dirname(historyPath), { recursive: true });
writeFileSync(historyPath, `${JSON.stringify(nextHistory, null, 2)}\n`);

console.log(`Archived Homebase verdict history: ${nextHistory.length}/${limit} entries`);
