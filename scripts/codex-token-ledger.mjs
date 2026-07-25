#!/usr/bin/env node

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import readline from "node:readline";
import { fileURLToPath } from "node:url";

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(SCRIPT_DIR, "..");
const DEFAULT_CODEX_HOME = path.join(os.homedir(), ".codex");
const DEFAULT_STATE_ROOT = path.join(DEFAULT_CODEX_HOME, "state", "codex-token-ledger");
const DEFAULT_DAYS = 7;
const DEFAULT_LIMIT = 20;
const DEFAULT_AGENT_WORD_LIMIT = 500;
const DEFAULT_REFERENCE_WORD_LIMIT = 3000;
const DEFAULT_SESSION_CACHE_MAX_ENTRIES = 2000;
const SKIP_DIRS = new Set([
  ".git",
  "node_modules",
  "archive",
  "backups",
  "dist",
  "build",
  ".next",
  ".cache",
  "logs",
  "reports",
  "test-results"
]);

const WARNING_PATTERNS = [
  ["invalid_skill_yaml", /failed to load skill|invalid YAML/i],
  ["plugin_prompt_too_long", /interface\.defaultPrompt|prompt must be at most 128/i],
  ["bad_icon_path", /interface\.icon_(small|large)|icon path with '\.\.'/i],
  ["rollout_db_discrepancy", /state db discrepancy|find_thread_path_by_id_str_in_subdir/i],
  ["mcp_handshake", /MCP startup failed|timed out handshaking|handshaking with MCP server/i],
  ["warning", /\bWARN\b/i],
  ["error", /\bERROR\b/i]
];

function usage() {
  return `Codex Token Ledger

Usage:
  node scripts/codex-token-ledger.mjs snapshot [--days N] [--limit N] [--state-root PATH] [--cache-max-entries N] [--no-cache] [--json]
  node scripts/codex-token-ledger.mjs budget [--root PATH] [--json]
  node scripts/codex-token-ledger.mjs sessions [--days N] [--limit N] [--state-root PATH] [--cache-max-entries N] [--no-cache] [--json]

Writes snapshot artifacts under:
  ${DEFAULT_STATE_ROOT}/<timestamp>/
`;
}

function parseArgs(argv) {
  const args = { _: [] };
  for (let i = 0; i < argv.length; i += 1) {
    const value = argv[i];
    if (value === "--") continue;
    if (!value.startsWith("--")) {
      args._.push(value);
      continue;
    }
    const key = value.slice(2);
    if (["json", "include-archived", "no-cache"].includes(key)) {
      args[key] = true;
      continue;
    }
    const next = argv[i + 1];
    if (!next || next.startsWith("--")) throw new Error(`Missing value for --${key}`);
    args[key] = next;
    i += 1;
  }
  return args;
}

function sessionRoots(codexHome = DEFAULT_CODEX_HOME, includeArchived = false) {
  const roots = [path.join(codexHome, "sessions")];
  if (includeArchived) roots.push(path.join(codexHome, "archived_sessions"));
  return roots;
}

function ensureStateRoot(stateRoot = DEFAULT_STATE_ROOT) {
  fs.mkdirSync(stateRoot, { recursive: true });
  return stateRoot;
}

function cacheFingerprint(stat) {
  return `${Number(stat.mtimeMs)}:${Number(stat.ctimeMs)}:${stat.size}`;
}

function readJson(filePath, fallback) {
  if (!fs.existsSync(filePath)) return fallback;
  try {
    const data = fs.readFileSync(filePath, "utf8").trim();
    if (!data) return fallback;
    return JSON.parse(data);
  } catch {
    return fallback;
  }
}

function saveJson(filePath, payload) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(payload, null, 2)}\n`);
}

function loadSessionCache(stateRoot = DEFAULT_STATE_ROOT) {
  const cachePath = path.join(ensureStateRoot(stateRoot), "session-cache.json");
  const cache = readJson(cachePath, { version: 1, entries: {}, generatedAt: null, stats: { hits: 0, misses: 0, files: 0 } });
  if (!cache || typeof cache !== "object" || cache.version !== 1 || typeof cache.entries !== "object") {
    return { version: 1, generatedAt: null, entries: {}, stats: { hits: 0, misses: 0, files: 0 } };
  }
  return cache;
}

function loadMemorySummary(stateRoot = DEFAULT_STATE_ROOT) {
  const memoryPath = path.join(ensureStateRoot(stateRoot), "memory-summary.json");
  return readJson(memoryPath, { version: 1, generatedAt: null, aggregate: null, topSessions: [], cacheStats: { hits: 0, misses: 0, files: 0 } });
}

function saveMemorySummary(stateRoot = DEFAULT_STATE_ROOT, aggregate = { sessionCount: 0, topSessions: [] }, cacheStats = { hits: 0, misses: 0, files: 0 }, command = "snapshot") {
  saveJson(path.join(stateRoot, "memory-summary.json"), {
    version: 1,
    generatedAt: new Date().toISOString(),
    aggregate,
    topSessions: aggregate.topSessions || [],
    cacheStats,
    command
  });
}

function pruneCacheEntries(entries = {}, limit = DEFAULT_SESSION_CACHE_MAX_ENTRIES) {
  const list = Object.entries(entries).sort((a, b) => (b[1].generatedAt || "").localeCompare(a[1].generatedAt || ""));
  if (list.length <= limit) return entries;
  const keep = new Set(list.slice(0, limit).map(([key]) => key));
  return Object.fromEntries(list.filter(([key]) => keep.has(key)));
}

function walkJsonl(dir) {
  if (!fs.existsSync(dir)) return [];
  const out = [];
  const stack = [dir];
  while (stack.length) {
    const current = stack.pop();
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      const full = path.join(current, entry.name);
      if (entry.isDirectory()) stack.push(full);
      if (entry.isFile() && entry.name.endsWith(".jsonl")) out.push(full);
    }
  }
  return out;
}

function cutoffDate(days = DEFAULT_DAYS, now = new Date()) {
  return new Date(now.getTime() - Number(days) * 24 * 60 * 60 * 1000);
}

function textFromContent(content) {
  if (typeof content === "string") return content;
  if (!Array.isArray(content)) return "";
  return content.map((part) => part?.text || part?.input_text || part?.output_text || "").filter(Boolean).join("\n");
}

function summarizeText(text, max = 96) {
  const oneLine = String(text || "").replace(/\s+/g, " ").trim();
  if (oneLine.length <= max) return oneLine;
  return `${oneLine.slice(0, Math.max(0, max - 3))}...`;
}

function isBootstrapContext(text) {
  const value = String(text || "").trim();
  return value.startsWith("# AGENTS.md instructions") || value.startsWith("<environment_context>");
}

function addUsage(target, usage = {}) {
  target.inputTokens += Number(usage.input_tokens || 0);
  target.cachedInputTokens += Number(usage.cached_input_tokens || 0);
  target.outputTokens += Number(usage.output_tokens || 0);
  target.reasoningOutputTokens += Number(usage.reasoning_output_tokens || 0);
  target.totalTokens += Number(usage.total_tokens || 0);
}

function emptyUsage() {
  return {
    inputTokens: 0,
    cachedInputTokens: 0,
    outputTokens: 0,
    reasoningOutputTokens: 0,
    totalTokens: 0
  };
}

function countWarningPatterns(text, counts) {
  if (!text) return;
  for (const [key, pattern] of WARNING_PATTERNS) {
    if (pattern.test(text)) counts[key] = (counts[key] || 0) + 1;
  }
}

function applyRecordToSession(session, record) {
  session.lineCount += 1;
  if (record.timestamp) {
    session.firstTimestamp ||= record.timestamp;
    session.lastTimestamp = record.timestamp;
  }

  if (record.type === "session_meta") {
    const payload = record.payload || {};
    session.id = payload.id || session.id;
    session.cwd = payload.cwd || session.cwd;
    session.originator = payload.originator || session.originator;
    session.cliVersion = payload.cli_version || session.cliVersion;
    session.firstTimestamp ||= payload.timestamp;
  }

  if (record.type === "turn_context") {
    session.cwd = record.payload?.cwd || session.cwd;
  }

  if (record.type === "response_item") {
    const payload = record.payload || {};
    if (payload.type === "function_call") {
      session.toolCalls += 1;
      session.toolNames[payload.name || "unknown"] = (session.toolNames[payload.name || "unknown"] || 0) + 1;
      countWarningPatterns(payload.arguments || "", session.warningCounts);
    }
    if (payload.type === "function_call_output") {
      session.toolOutputs += 1;
      const output = String(payload.output || "");
      countWarningPatterns(output, session.warningCounts);
      const match = output.match(/Original token count:\s*(\d+)/);
      if (match) session.toolOutputOriginalTokens += Number(match[1]);
    }
    if (payload.type === "message") {
      const role = payload.role;
      const text = summarizeText(textFromContent(payload.content), 4000);
      countWarningPatterns(text, session.warningCounts);
      if (role === "user" && text && !isBootstrapContext(text)) {
        session.firstUser ||= text;
        session.lastUser = text;
      }
      if (role === "assistant" && text) session.lastAssistant = text;
    }
  }

  if (record.type === "event_msg") {
    const payload = record.payload || {};
    const text = String(payload.message || payload.last_agent_message || "");
    countWarningPatterns(text, session.warningCounts);

    if (payload.type === "token_count") {
      const info = payload.info || {};
      session.tokenEvents += 1;
      addUsage(session.sumLastUsage, info.last_token_usage || {});
      session.lastUsage = normalizeUsage(info.last_token_usage || {});
      const totalUsage = normalizeUsage(info.total_token_usage || {});
      session.finalTotalUsage = totalUsage;
      if (totalUsage.totalTokens > session.maxTotalUsage.totalTokens) session.maxTotalUsage = totalUsage;
      session.modelContextWindow = info.model_context_window || session.modelContextWindow;
    }

    if (payload.type === "user_message" && text && !isBootstrapContext(text)) {
      session.firstUser ||= text;
      session.lastUser = text;
    }
    if (payload.type === "agent_message" && text) session.lastAssistant = text;
    if (payload.type === "task_complete") {
      session.completedAt = payload.completed_at || session.completedAt;
      session.durationMs = payload.duration_ms || session.durationMs;
      session.timeToFirstTokenMs = payload.time_to_first_token_ms || session.timeToFirstTokenMs;
    }
  }
}

function normalizeUsage(usage = {}) {
  return {
    inputTokens: Number(usage.input_tokens || 0),
    cachedInputTokens: Number(usage.cached_input_tokens || 0),
    outputTokens: Number(usage.output_tokens || 0),
    reasoningOutputTokens: Number(usage.reasoning_output_tokens || 0),
    totalTokens: Number(usage.total_tokens || 0)
  };
}

function createSessionSummary(filePath, stat = { mtime: new Date(), size: 0 }) {
  return {
    id: null,
    path: filePath,
    bytes: stat.size,
    mtime: stat.mtime.toISOString(),
    cwd: null,
    originator: null,
    cliVersion: null,
    firstTimestamp: null,
    lastTimestamp: null,
    completedAt: null,
    durationMs: null,
    timeToFirstTokenMs: null,
    firstUser: null,
    lastUser: null,
    lastAssistant: null,
    title: null,
    lineCount: 0,
    tokenEvents: 0,
    sumLastUsage: emptyUsage(),
    lastUsage: emptyUsage(),
    finalTotalUsage: emptyUsage(),
    maxTotalUsage: emptyUsage(),
    modelContextWindow: null,
    toolCalls: 0,
    toolOutputs: 0,
    toolNames: {},
    toolOutputOriginalTokens: 0,
    warningCounts: {}
  };
}

function normalizeCachedSummary(filePath, summary) {
  const fixed = summary && typeof summary === "object" ? summary : createSessionSummary(filePath, { mtime: new Date(), size: 0 });
  return {
    ...fixed,
    path: fixed.path || filePath,
    warningCounts: fixed.warningCounts || {},
    sumLastUsage: fixed.sumLastUsage || emptyUsage(),
    lastUsage: fixed.lastUsage || emptyUsage(),
    finalTotalUsage: fixed.finalTotalUsage || emptyUsage(),
    maxTotalUsage: fixed.maxTotalUsage || fixed.finalTotalUsage || emptyUsage(),
    toolNames: fixed.toolNames || {}
  };
}

function finalizeSession(session) {
  if (!session.id) {
    const match = path.basename(session.path).match(/([0-9a-f]{8}-[0-9a-f-]{27,})\.jsonl$/i);
    session.id = match?.[1] || path.basename(session.path, ".jsonl");
  }
  session.title = summarizeText(session.firstUser || path.basename(session.path), 96);
  session.cacheHitRate = session.sumLastUsage.inputTokens > 0
    ? session.sumLastUsage.cachedInputTokens / session.sumLastUsage.inputTokens
    : 0;
  session.warningTotal = Object.values(session.warningCounts).reduce((sum, value) => sum + value, 0);
  return session;
}

async function analyzeSessionFile(filePath) {
  const stat = fs.statSync(filePath);
  const session = createSessionSummary(filePath, stat);
  const stream = fs.createReadStream(filePath, { encoding: "utf8" });
  const reader = readline.createInterface({ input: stream, crlfDelay: Infinity });

  for await (const line of reader) {
    if (!line.trim()) continue;
    let record;
    try {
      record = JSON.parse(line);
    } catch {
      continue;
    }
    applyRecordToSession(session, record);
  }
  return finalizeSession(session);
}

function parseSessionRecords(records, filePath = "fixture.jsonl") {
  const session = createSessionSummary(filePath, { mtime: new Date("2026-06-06T00:00:00.000Z"), size: 0 });
  for (const record of records) applyRecordToSession(session, record);
  return finalizeSession(session);
}

async function loadRecentSessions({
  codexHome = DEFAULT_CODEX_HOME,
  days = DEFAULT_DAYS,
  includeArchived = false,
  limit = 0,
  stateRoot = DEFAULT_STATE_ROOT,
  useCache = true,
  cacheMaxEntries = DEFAULT_SESSION_CACHE_MAX_ENTRIES
} = {}) {
  const cutoff = cutoffDate(days);
  const files = sessionRoots(codexHome, includeArchived)
    .flatMap(walkJsonl)
    .map((file) => ({ file, stat: fs.statSync(file) }))
    .filter(({ stat }) => stat.mtime >= cutoff)
    .sort((a, b) => b.stat.mtime - a.stat.mtime);

  const selected = Number(limit) > 0 ? files.slice(0, Number(limit)) : files;
  const cache = useCache ? loadSessionCache(stateRoot) : { version: 1, entries: {} };
  const nextCacheEntries = { ...(cache.entries || {}) };
  const cacheStats = { hits: 0, misses: 0, files: selected.length };
  const sessions = [];
  for (const { file, stat } of selected) {
    const absolutePath = path.resolve(file);
    const fingerprint = cacheFingerprint(stat);
    const cached = cache.entries[absolutePath];
    if (useCache && cached && cached.fingerprint === fingerprint && cached.summary?.maxTotalUsage) {
      sessions.push(normalizeCachedSummary(absolutePath, cached.summary));
      cacheStats.hits += 1;
      continue;
    }
    const session = await analyzeSessionFile(file);
    sessions.push(session);
    nextCacheEntries[absolutePath] = {
      path: absolutePath,
      fingerprint,
      generatedAt: new Date().toISOString(),
      stat: { mtimeMs: stat.mtimeMs, size: stat.size },
      summary: session
    };
    cacheStats.misses += 1;
  }
  const cachePath = path.join(stateRoot, "session-cache.json");
  const pruned = pruneCacheEntries(nextCacheEntries, cacheMaxEntries);
  saveJson(cachePath, {
    version: 1,
    generatedAt: new Date().toISOString(),
    entries: pruned,
    stats: cacheStats
  });
  const ordered = sessions.sort((a, b) => new Date(b.mtime) - new Date(a.mtime));
  return {
    sessions: ordered,
    cacheStats
  };
}

function aggregateSessions(sessions) {
  const totals = emptyUsage();
  const warningCounts = {};
  const cwdCounts = {};
  for (const session of sessions) {
    addUsage(totals, {
      input_tokens: session.sumLastUsage.inputTokens,
      cached_input_tokens: session.sumLastUsage.cachedInputTokens,
      output_tokens: session.sumLastUsage.outputTokens,
      reasoning_output_tokens: session.sumLastUsage.reasoningOutputTokens,
      total_tokens: session.sumLastUsage.totalTokens
    });
    cwdCounts[session.cwd || "unknown"] = (cwdCounts[session.cwd || "unknown"] || 0) + 1;
    for (const [key, value] of Object.entries(session.warningCounts)) {
      warningCounts[key] = (warningCounts[key] || 0) + value;
    }
  }
  return {
    sessionCount: sessions.length,
    totals,
    uncachedInputTokens: Math.max(0, totals.inputTokens - totals.cachedInputTokens),
    cacheHitRate: totals.inputTokens > 0 ? totals.cachedInputTokens / totals.inputTokens : 0,
    warningCounts,
    cwdCounts,
    topSessions: [...sessions].sort((a, b) => b.sumLastUsage.totalTokens - a.sumLastUsage.totalTokens).slice(0, 10)
  };
}

function wordCount(text) {
  return String(text || "").trim().split(/\s+/).filter(Boolean).length;
}

function walkInstructionFiles(root, maxDepth = 4) {
  const out = [];
  const stack = [{ dir: root, depth: 0 }];
  while (stack.length) {
    const { dir, depth } = stack.pop();
    if (!fs.existsSync(dir) || depth > maxDepth) continue;
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (!SKIP_DIRS.has(entry.name)) stack.push({ dir: full, depth: depth + 1 });
        continue;
      }
      if (entry.isFile() && (entry.name === "AGENTS.md" || entry.name === "CODEX-BRIEFING.md")) out.push(full);
    }
  }
  return out.sort();
}

function runtimeInstructionFiles() {
  return [
    path.join(os.homedir(), ".codex", "AGENTS.md"),
    path.join(ROOT, "AGENTS.md"),
    path.join(ROOT, "docs", "AGENTS.md"),
    path.join(ROOT, "docs", "CODEX-BRIEFING.md")
  ].filter((file) => fs.existsSync(file));
}

function auditInstructionBudget({
  roots = null,
  agentWordLimit = DEFAULT_AGENT_WORD_LIMIT,
  referenceWordLimit = DEFAULT_REFERENCE_WORD_LIMIT
} = {}) {
  const files = [...new Set(roots ? roots.flatMap((root) => walkInstructionFiles(root)) : runtimeInstructionFiles())];
  const results = files.map((file) => {
    const text = fs.readFileSync(file, "utf8");
    const words = wordCount(text);
    const basename = path.basename(file);
    const issues = [];
    const isAgent = basename === "AGENTS.md";
    const isBriefing = basename === "CODEX-BRIEFING.md";
    if (isAgent && words > agentWordLimit) issues.push(`AGENTS.md over ${agentWordLimit} words`);
    if (isBriefing && words > referenceWordLimit) issues.push(`CODEX-BRIEFING.md over ${referenceWordLimit} words`);
    if (/Want me to write|Let me think|Here's what I'd|coding super-genius|uncanny extension/i.test(text)) {
      issues.push("pasted conversational briefing marker");
    }
    if (/read [`'"]?docs\/CODEX-BRIEFING\.md/i.test(text) && !/on demand|reference-only|only when needed/i.test(text)) {
      issues.push("CODEX-BRIEFING appears default-loaded");
    }
    if (isBriefing && !/reference-only|do not load it by default|read on demand/i.test(text)) {
      issues.push("briefing is not explicitly reference-only");
    }
    return { file, words, issues, ok: issues.length === 0 };
  });
  return {
    ok: results.every((result) => result.ok),
    checkedAt: new Date().toISOString(),
    agentWordLimit,
    referenceWordLimit,
    files: results
  };
}

function formatNumber(value) {
  return Math.round(Number(value || 0)).toLocaleString("en-US");
}

function formatPct(value) {
  return `${(Number(value || 0) * 100).toFixed(1)}%`;
}

function renderReport({
  days,
  sessions,
  aggregate,
  budget,
  runDir,
  cacheStats = { hits: 0, misses: 0, files: 0 },
  memorySummary = { generatedAt: null }
}) {
  const top = aggregate.topSessions.map((session) =>
    `| ${session.mtime.slice(0, 10)} | ${formatNumber(session.sumLastUsage.totalTokens)} | ${formatPct(session.cacheHitRate)} | ${session.cwd || "unknown"} | ${session.title.replace(/\|/g, "\\|")} |`
  );
  const warnings = Object.entries(aggregate.warningCounts)
    .sort((a, b) => b[1] - a[1])
    .map(([key, count]) => `| ${key} | ${formatNumber(count)} |`);
  const budgetRows = budget.files.map((file) =>
    `| ${file.ok ? "ok" : "fail"} | ${formatNumber(file.words)} | ${file.file} | ${file.issues.join("; ") || "-"} |`
  );

  return `# Codex Token Ledger

Window: last ${days} day(s)

## Summary

- Sessions analyzed: ${sessions.length}
- Cache hits from prior runs: ${cacheStats.hits}
- Cache misses (reparsed): ${cacheStats.misses}
- Sum of last-token usage events: ${formatNumber(aggregate.totals.totalTokens)} tokens
- Input tokens: ${formatNumber(aggregate.totals.inputTokens)}
- Cached input tokens: ${formatNumber(aggregate.totals.cachedInputTokens)}
- Uncached input tokens: ${formatNumber(aggregate.uncachedInputTokens)}
- Cache hit rate: ${formatPct(aggregate.cacheHitRate)}
- Output tokens: ${formatNumber(aggregate.totals.outputTokens)}
- Reasoning output tokens: ${formatNumber(aggregate.totals.reasoningOutputTokens)}
- Warning hits: ${formatNumber(Object.values(aggregate.warningCounts).reduce((sum, count) => sum + count, 0))}
- Instruction budget: ${budget.ok ? "PASS" : "FAIL"}
- Memory baseline: ${memorySummary.generatedAt ? new Date(memorySummary.generatedAt).toISOString() : "none"}

## Top Sessions

| Date | Tokens | Cache | CWD | Title |
|---|---:|---:|---|---|
${top.join("\n") || "| - | - | - | - | - |"}

## Warning Hits

| Pattern | Count |
|---|---:|
${warnings.join("\n") || "| - | 0 |"}

## Instruction Budget

| Status | Words | File | Issues |
|---|---:|---|---|
${budgetRows.join("\n") || "| - | - | - | - |"}

Artifacts: ${runDir}
`;
}

function writeSnapshot({
  sessions,
  aggregate,
  budget,
  days,
  stateRoot = DEFAULT_STATE_ROOT,
  cacheStats = { hits: 0, misses: 0, files: 0 }
}) {
  const runName = new Date().toISOString().replace(/[:.]/g, "-");
  const runDir = path.join(stateRoot, runName);
  fs.mkdirSync(runDir, { recursive: true });
  const payload = { generatedAt: new Date().toISOString(), days, aggregate, sessions };
  const memorySummary = loadMemorySummary(stateRoot);
  fs.writeFileSync(path.join(runDir, "summary.json"), `${JSON.stringify(payload, null, 2)}\n`);
  fs.writeFileSync(path.join(runDir, "sessions.jsonl"), `${sessions.map((session) => JSON.stringify(session)).join("\n")}\n`);
  fs.writeFileSync(path.join(runDir, "instruction-budget.json"), `${JSON.stringify(budget, null, 2)}\n`);
  fs.writeFileSync(path.join(runDir, "report.md"), renderReport({
    days,
    sessions,
    aggregate,
    budget,
    cacheStats,
    memorySummary,
    runDir
  }));
  saveMemorySummary(stateRoot, aggregate, cacheStats, "snapshot");
  fs.rmSync(path.join(stateRoot, "latest"), { recursive: true, force: true });
  try {
    fs.symlinkSync(runDir, path.join(stateRoot, "latest"));
  } catch {
    fs.mkdirSync(path.join(stateRoot, "latest"), { recursive: true });
    for (const file of ["summary.json", "sessions.jsonl", "instruction-budget.json", "report.md"]) {
      fs.copyFileSync(path.join(runDir, file), path.join(stateRoot, "latest", file));
    }
  }
  return runDir;
}

async function main(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  const command = args._[0] || "snapshot";
  const days = Number(args.days || DEFAULT_DAYS);
  const limit = Number(args.limit || 0);
  const codexHome = args["codex-home"] || DEFAULT_CODEX_HOME;
  const stateRoot = args["state-root"] || DEFAULT_STATE_ROOT;
  const useCache = !args["no-cache"];
  const cacheMaxEntries = Number(args["cache-max-entries"] || DEFAULT_SESSION_CACHE_MAX_ENTRIES);

  if (["-h", "--help", "help"].includes(command)) {
    console.log(usage());
    return 0;
  }

  if (command === "budget") {
    const roots = args.root ? [path.resolve(args.root)] : null;
    const budget = auditInstructionBudget({ roots });
    if (args.json) console.log(JSON.stringify(budget, null, 2));
    else {
      for (const file of budget.files) {
        console.log(`${file.ok ? "ok" : "fail"} words=${file.words} ${file.file}${file.issues.length ? ` issues=${file.issues.join("; ")}` : ""}`);
      }
      console.log(`instruction_budget=${budget.ok ? "pass" : "fail"}`);
    }
    return budget.ok ? 0 : 1;
  }

  if (command !== "snapshot" && command !== "sessions") throw new Error(`Unknown command: ${command}`);

  const startedAt = Date.now();
  const { sessions, cacheStats } = await loadRecentSessions({
    codexHome,
    days,
    includeArchived: args["include-archived"],
    limit,
    stateRoot,
    useCache,
    cacheMaxEntries
  });
  const aggregate = aggregateSessions(sessions);
  const elapsedMs = Date.now() - startedAt;
  const budget = auditInstructionBudget();
  if (command === "sessions") {
    saveMemorySummary(stateRoot, aggregate, cacheStats, "sessions");
    if (args.json) console.log(JSON.stringify({ days, aggregate, sessions, cacheStats, elapsedMs }, null, 2));
    else {
      for (const session of sessions.slice(0, Number(args.limit || DEFAULT_LIMIT))) {
        console.log(`${session.mtime.slice(0, 10)} tokens=${session.sumLastUsage.totalTokens} cache=${formatPct(session.cacheHitRate)} cwd=${session.cwd || "unknown"} title=${session.title}`);
      }
      console.log(`codex_token_ledger: cache_hits=${cacheStats.hits} cache_misses=${cacheStats.misses}`);
      console.log(`codex_token_ledger: elapsed_ms=${elapsedMs}`);
    }
    return 0;
  }

  const runDir = writeSnapshot({ sessions, aggregate, budget, days, stateRoot, cacheStats });
  if (args.json) console.log(JSON.stringify({ runDir, days, aggregate, budget, cacheStats, elapsedMs }, null, 2));
  else {
    console.log(`codex_token_ledger: run_dir=${runDir}`);
    console.log(`codex_token_ledger: sessions=${sessions.length} tokens=${formatNumber(aggregate.totals.totalTokens)} cache_hit=${formatPct(aggregate.cacheHitRate)} instruction_budget=${budget.ok ? "pass" : "fail"}`);
    console.log(`codex_token_ledger: cache_hits=${cacheStats.hits} cache_misses=${cacheStats.misses}`);
    console.log(`codex_token_ledger: elapsed_ms=${elapsedMs}`);
    console.log(`codex_token_ledger: report=${path.join(runDir, "report.md")}`);
  }
  return budget.ok ? 0 : 1;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().then((code) => process.exit(code)).catch((error) => {
    console.error(error.stack || error.message);
    process.exit(1);
  });
}

export {
  aggregateSessions,
  auditInstructionBudget,
  loadRecentSessions,
  parseArgs,
  parseSessionRecords,
  renderReport,
  wordCount
};
