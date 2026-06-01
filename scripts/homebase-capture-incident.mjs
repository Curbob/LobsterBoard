#!/usr/bin/env node

import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join } from 'node:path';

const DATA_DIR = join(process.cwd(), 'data', 'teddy-house');
const QA_REPORT = join(process.cwd(), 'artifacts', 'qa', 'homebase-latest.json');
const DRAFT_DIR = join(DATA_DIR, 'qa', 'incident-drafts');
const SOURCE_FILES = [
  'snapshot.json',
  'service-logs.json',
  'system-logs.json',
  'timeline.json',
  'visual-evidence.json'
];

function argValue(name, fallback = null) {
  const index = process.argv.indexOf(`--${name}`);
  if (index === -1) return fallback;
  return process.argv[index + 1] || fallback;
}

function slug(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80) || 'homebase-incident';
}

function redactText(value) {
  return String(value || '')
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, '[email]')
    .replace(/\b\d{1,3}(?:\.\d{1,3}){3}\b/g, '[ip]')
    .replace(/\b100\.\d{1,3}\.\d{1,3}\.\d{1,3}\b/g, '[tailscale-ip]')
    .replace(/\b(?:8443,\s*10000|10000,\s*8443)\b/g, '[public-routes]')
    .replace(/\/Users\/[^/\s"]+/g, '/Users/[user]')
    .replace(/tail[a-z0-9-]*\.ts\.net/gi, '[tailnet-host]')
    .replace(/openclaw-mac-mini[^\s"]*/gi, '[homebase-host]');
}

async function readJson(file) {
  const text = await readFile(file, 'utf8');
  return JSON.parse(text);
}

function compactSummary(name, data) {
  if (!data || typeof data !== 'object') return 'No structured summary available.';
  if (name === 'snapshot.json') {
    return redactText([
      `score=${data.score}`,
      `homebridgeLog=${data.homebridgeLogState}`,
      `serviceLog=${data.serviceLogValue || data.serviceLogState}`,
      `systemLog=${data.systemLogMetric || data.systemLogState}`,
      `publicRoutes=${data.funnelMetric ? '[redacted]' : 'none'}`
    ].filter(Boolean).join('; '));
  }
  if (name === 'service-logs.json') {
    return redactText(`${data.value || data.metric || data.state}; ${data.detail || ''}`);
  }
  if (name === 'system-logs.json') {
    return redactText(`${data.metric || data.state}; ${data.detail || ''}`);
  }
  if (name === 'timeline.json') {
    const events = Array.isArray(data.events) ? data.events : [];
    return redactText(`${events.length} timeline events; latest=${events[0]?.title || 'none'} ${events[0]?.detail || ''}`);
  }
  if (name === 'visual-evidence.json') {
    const entries = Array.isArray(data.entries) ? data.entries : [];
    return redactText(`${entries.length} visual evidence entries; latest keys=${Object.keys(entries[0]?.visuals || {}).join(', ')}`);
  }
  return redactText(JSON.stringify(data).slice(0, 240));
}

function serviceLogExcerpts(data) {
  const items = [];
  const serviceItems = Array.isArray(data?.items) ? data.items : [];
  for (const item of serviceItems) {
    const examples = Array.isArray(item.examples) ? item.examples : [];
    if (!examples.length && !item.detail) continue;
    items.push({
      source: redactText(item.name || 'service log'),
      redacted: true,
      text: redactText(examples[0] || item.detail)
    });
  }
  return items;
}

function systemLogExcerpt(data) {
  if (!data?.detail) return [];
  return [{
    source: 'system diagnostics',
    redacted: true,
    text: redactText(data.detail)
  }];
}

function expectedStory(report, fallbackTitle) {
  const local = report?.local || {};
  const screenshots = Array.isArray(local?.screenshots?.outputs) ? local.screenshots.outputs : [];
  const firstReview = local.firstReview || screenshots.find(item => item.firstReview)?.firstReview || null;
  return {
    headline: local.headline || report?.truthVerdict?.label || fallbackTitle,
    firstZone: local.firstZone || report?.truthVerdict?.firstZone || 'unknown',
    firstReview: firstReview || undefined,
    firstAction: local.firstDecision || report?.truthVerdict?.firstAction || 'Review Homebase.'
  };
}

async function main() {
  const now = new Date().toISOString();
  const report = existsSync(QA_REPORT) ? await readJson(QA_REPORT) : {};
  const defaultTitle = report?.truthVerdict?.label || report?.local?.headline || 'Homebase incident';
  const title = argValue('title', defaultTitle);
  const id = slug(argValue('id', `${now.slice(0, 10)}-${title}`));
  const fixture = argValue('fixture', 'needs-fixture');
  const checkedAt = report?.generatedAt || now;

  const sourceSnapshots = [];
  const logExcerpts = [];
  for (const sourceFile of SOURCE_FILES) {
    const path = join(DATA_DIR, sourceFile);
    if (!existsSync(path)) continue;
    const data = await readJson(path);
    sourceSnapshots.push({
      path: `data/teddy-house/${sourceFile}`,
      checkedAt,
      redacted: true,
      summary: compactSummary(sourceFile, data)
    });
    if (sourceFile === 'service-logs.json') logExcerpts.push(...serviceLogExcerpts(data));
    if (sourceFile === 'system-logs.json') logExcerpts.push(...systemLogExcerpt(data));
  }

  const bundle = {
    id,
    title: redactText(title),
    recordedAt: checkedAt,
    fixture,
    status: 'draft',
    note: 'Draft captured from persisted Homebase evidence. Review, choose/create a replay fixture, then promote into the permanent incident fixture directory when it should become a regression.',
    sourceSnapshots,
    logExcerpts: logExcerpts.slice(0, 8),
    expected: expectedStory(report, title)
  };

  await mkdir(DRAFT_DIR, { recursive: true });
  const outputFile = join(DRAFT_DIR, `${id}.json`);
  await writeFile(outputFile, `${JSON.stringify(bundle, null, 2)}\n`);
  console.log(JSON.stringify({
    status: 'ok',
    outputFile,
    id,
    title: bundle.title,
    snapshots: sourceSnapshots.length,
    logExcerpts: bundle.logExcerpts.length,
    fixture
  }, null, 2));
}

main().catch(error => {
  console.error(error.stack || error.message);
  process.exit(1);
});
