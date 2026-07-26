#!/usr/bin/env node

import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

const metricsPath = process.env.HOMEBASE_ASK_METRICS_FILE
  || join(process.cwd(), 'data', 'teddy-house', 'ask-metrics.json');
const liveProofPath = process.env.HOMEBASE_LIVE_TEDDY_PROOF_FILE
  || join(process.cwd(), 'artifacts', 'qa', 'homebase-live-teddy-proof-latest.json');
const tokenBudget = Number(process.env.HOMEBASE_ASK_TOKEN_BUDGET || 2000);
const latencyBudgetMs = Number(process.env.HOMEBASE_ASK_LATENCY_BUDGET_MS || 8000);

function percentile(values, percentileValue) {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.ceil((percentileValue / 100) * sorted.length) - 1)];
}

function evaluateAskBudget(entries) {
  const recent = Array.isArray(entries) ? entries.slice(0, 200) : [];
  const local = recent.filter(entry => entry.route === 'local');
  const hermes = recent.filter(entry => entry.route === 'hermes' && entry.source === 'teddy');
  const failures = [];
  if (local.some(entry => Number(entry.totalTokens) !== 0 || Number(entry.modelCalls) !== 0)) {
    failures.push('local answers must use zero model tokens and calls');
  }
  if (hermes.some(entry => entry.usageCaptured !== true)) failures.push('Hermes usage must be captured');
  const hermesTokens = hermes.map(entry => Number(entry.totalTokens)).filter(Number.isFinite);
  const hermesLatency = hermes.map(entry => Number(entry.latencyMs)).filter(Number.isFinite);
  const p95Tokens = percentile(hermesTokens, 95);
  const p95LatencyMs = percentile(hermesLatency, 95);
  if (p95Tokens !== null && p95Tokens > tokenBudget) failures.push(`Hermes p95 tokens ${p95Tokens} exceed ${tokenBudget}`);
  if (p95LatencyMs !== null && p95LatencyMs > latencyBudgetMs) failures.push(`Hermes p95 latency ${p95LatencyMs}ms exceeds ${latencyBudgetMs}ms`);
  if (hermes.some(entry => Number(entry.toolCalls || 0) > 0 && entry.action === 'status')) {
    failures.push('status proof must not use tools');
  }
  return {
    status: failures.length > 0 ? 'fail' : hermes.length > 0 && local.length > 0 ? 'ok' : 'partial',
    failures,
    samples: { total: recent.length, local: local.length, hermes: hermes.length },
    budgets: { tokenBudget, latencyBudgetMs },
    observed: { p95Tokens, p95LatencyMs }
  };
}

function readMetrics(path = metricsPath) {
  const entries = [];
  if (existsSync(path)) {
    const data = JSON.parse(readFileSync(path, 'utf8'));
    if (Array.isArray(data.entries)) entries.push(...data.entries);
  }
  if (existsSync(liveProofPath)) {
    const proof = JSON.parse(readFileSync(liveProofPath, 'utf8'));
    if (proof?.source === 'teddy' && proof?.metrics) {
      entries.unshift({
        at: proof.capturedAt,
        action: 'status',
        source: proof.source,
        run: proof.run,
        ...proof.metrics
      });
    }
  }
  return entries;
}

function main() {
  const result = evaluateAskBudget(readMetrics());
  console.log(JSON.stringify({ ...result, metricsPath }, null, 2));
  if (result.status === 'fail' || (result.status !== 'ok' && process.env.HOMEBASE_REQUIRE_ASK_BUDGET === '1')) process.exit(1);
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) main();

export { evaluateAskBudget, percentile };
