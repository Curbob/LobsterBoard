import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const reportPath = join(process.cwd(), 'artifacts', 'qa', 'homebase-latest.json');
const baselinePath = join(process.cwd(), 'tests', 'fixtures', 'teddy-house', 'visual-baseline.json');

function readJson(path) {
  return JSON.parse(readFileSync(path, 'utf8'));
}

function checkVisualBaseline(report, baseline) {
  const screenshots = report?.local?.screenshots?.outputs || [];
  const failures = [];
  const items = [];
  for (const [name, expected] of Object.entries(baseline.viewports || {})) {
    const shot = screenshots.find(item => item.name === name);
    if (!shot) {
      failures.push(`${name}: missing screenshot output`);
      continue;
    }
    const missingFields = (baseline.requiredFields || []).filter(field => {
      if (field === 'frozenHealth') return shot.frozenHealth !== true;
      return shot[field] === null || shot[field] === undefined || shot[field] === '';
    });
    const missingContracts = (baseline.requiredVisualContracts || []).filter(key => shot.visualContract?.[key] !== true);
    const scrollOverrun = Number(shot.scrollWidth) - Number(shot.width);
    const textLength = Number(shot.firstScreenTextLength || 0);
    if (shot.width !== expected.width || shot.height !== expected.height) {
      failures.push(`${name}: viewport drifted ${shot.width}x${shot.height}, expected ${expected.width}x${expected.height}`);
    }
    if (scrollOverrun > Number(expected.maxScrollOverrun || 0)) {
      failures.push(`${name}: horizontal overflow ${shot.scrollWidth}/${shot.width}`);
    }
    if (textLength > Number(expected.maxFirstScreenTextLength || 0)) {
      failures.push(`${name}: first-screen text ${textLength}/${expected.maxFirstScreenTextLength}`);
    }
    if (missingFields.length > 0) failures.push(`${name}: missing fields ${missingFields.join(', ')}`);
    if (missingContracts.length > 0) failures.push(`${name}: failed contracts ${missingContracts.join(', ')}`);
    items.push({
      name,
      width: shot.width,
      height: shot.height,
      scrollWidth: shot.scrollWidth,
      firstScreenTextLength: textLength,
      maxFirstScreenTextLength: expected.maxFirstScreenTextLength,
      ok: missingFields.length === 0
        && missingContracts.length === 0
        && scrollOverrun <= Number(expected.maxScrollOverrun || 0)
        && textLength <= Number(expected.maxFirstScreenTextLength || 0)
        && shot.width === expected.width
        && shot.height === expected.height
    });
  }
  return {
    status: failures.length === 0 ? 'ok' : 'fail',
    detail: failures.length === 0
      ? items.map(item => `${item.name}:${item.firstScreenTextLength}/${item.maxFirstScreenTextLength}`).join(', ')
      : failures.join('; '),
    items
  };
}

const report = readJson(reportPath);
const baseline = readJson(baselinePath);
const result = checkVisualBaseline(report, baseline);

console.log(`Homebase visual baseline: ${result.status}`);
console.log(result.detail);

if (result.status !== 'ok') process.exit(1);

export { checkVisualBaseline };
