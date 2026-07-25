#!/usr/bin/env node

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { loadRecentSessions } from "./codex-token-ledger.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const DEFAULT_CODEX_HOME = path.join(os.homedir(), ".codex");
const DEFAULT_HERMES_HOME = process.env.HERMES_HOME || "/Volumes/MacMiniWork/Hermes";
const DEFAULT_STATE_ROOT = path.join(DEFAULT_CODEX_HOME, "state", "codex-cost-preflight");
const DEFAULT_DAYS = 30;
const DEFAULT_WARN_TOKENS = 25_000_000;
const DEFAULT_URGENT_TOKENS = 300_000_000;
const DEFAULT_LIMIT = 8;
const DEFAULT_INCLUDE_ARCHIVED = true;
const DEFAULT_MEMORY_WARN_BYTES = 250_000;
const DEFAULT_CAP_SCENARIOS = [100_000_000, 75_000_000, 50_000_000, 25_000_000, 10_000_000];

function parseArgs(argv) {
  const args = {};
  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index];
    if (!value.startsWith("--")) continue;
    const key = value.slice(2);
    if (["json", "include-archived", "active-only", "no-cache"].includes(key)) {
      args[key] = true;
      continue;
    }
    const next = argv[index + 1];
    if (!next || next.startsWith("--")) throw new Error(`Missing value for --${key}`);
    args[key] = next;
    index += 1;
  }
  return args;
}

function stamp() {
  return new Date().toISOString().replace(/[:.]/g, "-");
}

function compactPath(cwd) {
  if (!cwd) return "unknown";
  const home = os.homedir();
  if (cwd === home) return "~";
  if (cwd.startsWith(`${home}/`)) return `~/${cwd.slice(home.length + 1)}`;
  return cwd;
}

function fieldValue(value) {
  return String(value ?? "-").replace(/\s+/g, "%20");
}

function safeFilePart(value) {
  return String(value || "unknown")
    .replace(os.homedir(), "~")
    .replace(/[^a-zA-Z0-9._~-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 120) || "unknown";
}

function atomicWriteText(filePath, text, { mode = 0o600 } = {}) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true, mode: 0o700 });
  const tempPath = path.join(path.dirname(filePath), `.${path.basename(filePath)}.${process.pid}.${Date.now()}.tmp`);
  fs.writeFileSync(tempPath, text, { mode });
  fs.renameSync(tempPath, filePath);
}

function usageTokens(session) {
  return Number(session.maxTotalUsage?.totalTokens || session.finalTotalUsage?.totalTokens || session.sumLastUsage?.totalTokens || 0);
}

function sessionSource(session) {
  return String(session.path || "").includes(`${path.sep}archived_sessions${path.sep}`) ? "archived" : "active";
}

function memoryRoots() {
  return [
    path.join(os.homedir(), ".codex", "AGENTS.md"),
    path.join(os.homedir(), ".codex", "memories", "memory_summary.md"),
    path.join(os.homedir(), ".codex", "memories", "MEMORY.md"),
    path.join(os.homedir(), ".codex", "memories", "extensions", "ad_hoc", "notes"),
    path.join(DEFAULT_HERMES_HOME, "SOUL.md"),
    path.join(DEFAULT_HERMES_HOME, "memories"),
    path.join(DEFAULT_HERMES_HOME, "migration", "openclaw-core", "MIGRATION_NOTES.md"),
  ];
}

function walkFiles(rootPath, out = []) {
  if (!fs.existsSync(rootPath)) return out;
  const stat = fs.statSync(rootPath);
  if (stat.isFile()) {
    out.push({ file: rootPath, stat });
    return out;
  }
  if (!stat.isDirectory()) return out;
  for (const entry of fs.readdirSync(rootPath, { withFileTypes: true })) {
    if ([".git", "node_modules", "rollout_summaries"].includes(entry.name)) continue;
    walkFiles(path.join(rootPath, entry.name), out);
  }
  return out;
}

function scanMemoryBait({ warnBytes = DEFAULT_MEMORY_WARN_BYTES } = {}) {
  const seen = new Set();
  const files = [];
  for (const rootPath of memoryRoots()) {
    for (const entry of walkFiles(rootPath)) {
      if (seen.has(entry.file)) continue;
      seen.add(entry.file);
      if (!/\.(md|txt|json|jsonl|toml|yaml|yml)$/.test(entry.file)) continue;
      files.push({
        file: entry.file,
        compactPath: compactPath(entry.file),
        bytes: entry.stat.size,
        modifiedAt: entry.stat.mtime.toISOString(),
        warn: entry.stat.size > warnBytes,
      });
    }
  }
  files.sort((a, b) => b.bytes - a.bytes);
  const rolloutDir = path.join(os.homedir(), ".codex", "memories", "rollout_summaries");
  const rolloutFiles = fs.existsSync(rolloutDir)
    ? fs.readdirSync(rolloutDir).filter((name) => name.endsWith(".jsonl") || name.endsWith(".md")).length
    : 0;
  return {
    warnBytes,
    files: files.length,
    bytes: files.reduce((sum, file) => sum + file.bytes, 0),
    warnFiles: files.filter((file) => file.warn).length,
    topFiles: files.slice(0, 8),
    rolloutSummariesSkipped: rolloutFiles,
    action: files.some((file) => file.warn) ? "search_index_then_targeted_read" : "none",
    cleanupCommand: "npm run codex:cost-preflight -- --json | jq '.memory.topFiles[] | select(.warn == true)'",
    note: "Search memory indexes first; do not read rollout summaries or large memory files unless the compact index points there.",
  };
}

function resolveCwdFilter(value) {
  if (!value) return null;
  return path.resolve(process.cwd(), value);
}

function hasPackageScript(cwd, scriptName) {
  if (!cwd) return false;
  const packagePath = path.join(cwd, "package.json");
  if (!fs.existsSync(packagePath)) return false;
  try {
    const parsed = JSON.parse(fs.readFileSync(packagePath, "utf8"));
    return Boolean(parsed.scripts?.[scriptName]);
  } catch {
    return false;
  }
}

function hasLocalPreflight(cwd) {
  if (!cwd) return false;
  if (cwd === os.homedir()) {
    const globalCard = path.join(os.homedir(), ".codex", "AGENTS.md");
    return fs.existsSync(globalCard) && /cost preflight|compact receipts/i.test(fs.readFileSync(globalCard, "utf8"));
  }
  if (hasPackageScript(cwd, "token:preflight")) return true;
  if (hasPackageScript(cwd, "codex:cost-preflight")) return true;
  if (hasPackageScript(cwd, "codex:sessions")) return true;
  if (fs.existsSync(path.join(cwd, "scripts", "token-preflight.sh"))) return true;
  if (fs.existsSync(path.join(cwd, "scripts", "token-preflight.js"))) return true;
  if (fs.existsSync(path.join(cwd, "scripts", "token-preflight.mjs"))) return true;
  return fs.existsSync(path.join(cwd, "CODEX_CONTEXT.md")) && /token:preflight|cost preflight/i.test(fs.readFileSync(path.join(cwd, "CODEX_CONTEXT.md"), "utf8"));
}

function groupByCwd(sessions) {
  const projects = new Map();
  for (const session of sessions) {
    const cwd = session.cwd || "unknown";
    const current = projects.get(cwd) || {
      cwd,
      sessions: 0,
      tokens: 0,
      maxSessionTokens: 0,
      hasLocalPreflight: false,
    };
    const tokens = usageTokens(session);
    current.sessions += 1;
    current.tokens += tokens;
    current.maxSessionTokens = Math.max(current.maxSessionTokens, tokens);
    projects.set(cwd, current);
  }
  for (const project of projects.values()) {
    project.hasLocalPreflight = hasLocalPreflight(project.cwd);
  }
  return [...projects.values()].sort((a, b) => b.tokens - a.tokens);
}

function buildReport({ sessions, days, warnTokens, urgentTokens, limit }) {
  const projects = groupByCwd(sessions);
  const topSessions = sessions
    .slice()
    .sort((a, b) => usageTokens(b) - usageTokens(a))
    .slice(0, limit)
    .map((session) => ({
      cwd: session.cwd || "unknown",
      cwdCompact: compactPath(session.cwd || "unknown"),
      tokens: usageTokens(session),
      date: (session.firstTimestamp || session.mtime || "").slice(0, 10),
      file: path.basename(session.path || ""),
    }));

  const warnings = [];
  for (const session of topSessions) {
    if (session.tokens >= urgentTokens) warnings.push({ level: "urgent", type: "huge-session", ...session });
    else if (session.tokens >= warnTokens) warnings.push({ level: "warn", type: "large-session", ...session });
  }
  for (const project of projects.slice(0, limit)) {
    if (project.tokens > 0 && project.cwd !== "unknown" && !project.hasLocalPreflight) {
      warnings.push({
        level: "warn",
        type: "missing-local-preflight",
        cwd: project.cwd,
        cwdCompact: compactPath(project.cwd),
        tokens: project.tokens,
      });
    }
  }

  const totalTokens = sessions.reduce((sum, session) => sum + usageTokens(session), 0);
  const sourceBreakdown = sessions.reduce((acc, session) => {
    const source = sessionSource(session);
    acc[source] ||= { sessions: 0, tokens: 0 };
    acc[source].sessions += 1;
    acc[source].tokens += usageTokens(session);
    return acc;
  }, {});
  const archivedOverWarnSessions = sessions.filter((session) => sessionSource(session) === "archived" && usageTokens(session) > warnTokens);
  const savingsByCwd = new Map();
  for (const session of sessions) {
    const cwd = session.cwd || "unknown";
    const tokens = usageTokens(session);
    const current = savingsByCwd.get(cwd) || { overWarnSessions: 0, avoidableAtWarnTokens: 0 };
    if (tokens > warnTokens) current.overWarnSessions += 1;
    current.avoidableAtWarnTokens += Math.max(0, tokens - warnTokens);
    savingsByCwd.set(cwd, current);
  }
  const savings = sessions.reduce((acc, session) => {
    const tokens = usageTokens(session);
    if (tokens > warnTokens) {
      acc.overWarnSessions += 1;
      acc.avoidableAtWarnTokens += tokens - warnTokens;
    }
    if (tokens > urgentTokens) {
      acc.urgentSessions += 1;
      acc.avoidableAtUrgentTokens += tokens - urgentTokens;
    }
    return acc;
  }, {
    capTokens: warnTokens,
    urgentTokens,
    overWarnSessions: 0,
    urgentSessions: 0,
    avoidableAtWarnTokens: 0,
    avoidableAtUrgentTokens: 0,
  });
  const capScenarioTokens = [...new Set([warnTokens, ...DEFAULT_CAP_SCENARIOS])].sort((a, b) => b - a);
  const capScenarios = capScenarioTokens.map((capTokens) => {
    const overCapSessions = sessions.filter((session) => usageTokens(session) > capTokens);
    const avoidableTokens = overCapSessions.reduce((sum, session) => sum + usageTokens(session) - capTokens, 0);
    return {
      capTokens,
      overCapSessions: overCapSessions.length,
      avoidableTokens,
      futureTokens: totalTokens - avoidableTokens,
      reductionPct: totalTokens > 0 ? Number(((avoidableTokens / totalTokens) * 100).toFixed(1)) : 0,
    };
  });
  return {
    generatedAt: new Date().toISOString(),
    days,
    totalSessions: sessions.length,
    totalTokens,
    sourceBreakdown,
    archiveRisk: {
      overWarnSessions: archivedOverWarnSessions.length,
      maxArchivedSessionTokens: archivedOverWarnSessions.reduce((max, session) => Math.max(max, usageTokens(session)), 0),
      action: archivedOverWarnSessions.length > 0 ? "do_not_replay_archive_use_receipt" : "none",
    },
    savings,
    capScenarios,
    topProjects: projects.slice(0, limit).map((project) => ({
      ...project,
      ...(savingsByCwd.get(project.cwd) || { overWarnSessions: 0, avoidableAtWarnTokens: 0 }),
      cwdCompact: compactPath(project.cwd),
    })),
    topSessions,
    warnings,
  };
}

function writeReport(report, stateRoot) {
  const reportRoot = report.cwdFilter
    ? path.join(stateRoot, "by-cwd", safeFilePart(report.cwdFilter))
    : stateRoot;
  fs.mkdirSync(reportRoot, { recursive: true, mode: 0o700 });
  const receiptPath = path.join(reportRoot, `${stamp()}-codex-cost-preflight.json`);
  const latestMode = report.includeArchived ? "latest-include-archived.json" : "latest-active-only.json";
  const payload = `${JSON.stringify(report, null, 2)}\n`;
  atomicWriteText(receiptPath, payload);
  atomicWriteText(path.join(reportRoot, "latest.json"), payload);
  atomicWriteText(path.join(reportRoot, latestMode), payload);
  return receiptPath;
}

function printCompact(report, receiptPath) {
  console.log([
    "CODEX_COST_PREFLIGHT",
    `days=${report.days}`,
    `sessions=${report.totalSessions}`,
    `tokens=${report.totalTokens}`,
    `warnings=${report.warnings.length}`,
    `includeArchived=${report.includeArchived ? "yes" : "no"}`,
    `receipt=${path.relative(ROOT, receiptPath).replace(/\\/g, "/")}`,
  ].join(" "));

  console.log([
    "CODEX_COST_ARCHIVE",
    `activeSessions=${report.sourceBreakdown.active?.sessions || 0}`,
    `activeTokens=${report.sourceBreakdown.active?.tokens || 0}`,
    `archivedSessions=${report.sourceBreakdown.archived?.sessions || 0}`,
    `archivedTokens=${report.sourceBreakdown.archived?.tokens || 0}`,
    `overCapArchivedSessions=${report.archiveRisk?.overWarnSessions || 0}`,
    `maxArchivedSessionTokens=${report.archiveRisk?.maxArchivedSessionTokens || 0}`,
    `action=${report.archiveRisk?.action || "none"}`,
  ].join(" "));

  for (const project of report.topProjects.slice(0, DEFAULT_LIMIT)) {
    console.log([
      "CODEX_COST_PROJECT",
      `tokens=${project.tokens}`,
      `sessions=${project.sessions}`,
      `maxSessionTokens=${project.maxSessionTokens}`,
      `localPreflight=${project.hasLocalPreflight ? "yes" : "no"}`,
      `cwd=${fieldValue(project.cwdCompact)}`,
    ].join(" "));
  }

  console.log([
    "CODEX_COST_SAVINGS",
    `capTokens=${report.savings.capTokens}`,
    `overCapSessions=${report.savings.overWarnSessions}`,
    `avoidableTokens=${report.savings.avoidableAtWarnTokens}`,
    `urgentSessions=${report.savings.urgentSessions}`,
    `urgentAvoidableTokens=${report.savings.avoidableAtUrgentTokens}`,
  ].join(" "));

  for (const project of report.topProjects
    .filter((project) => project.avoidableAtWarnTokens > 0)
    .sort((a, b) => b.avoidableAtWarnTokens - a.avoidableAtWarnTokens)
    .slice(0, Math.min(5, DEFAULT_LIMIT))) {
    console.log([
      "CODEX_COST_ACTION",
      `avoidableTokens=${project.avoidableAtWarnTokens}`,
      `overCapSessions=${project.overWarnSessions}`,
      `maxSessionTokens=${project.maxSessionTokens}`,
      `action=split_thread_checkpoint`,
      `cwd=${fieldValue(project.cwdCompact)}`,
    ].join(" "));
  }

  for (const scenario of report.capScenarios || []) {
    console.log([
      "CODEX_COST_CAP",
      `capTokens=${scenario.capTokens}`,
      `overCapSessions=${scenario.overCapSessions}`,
      `avoidableTokens=${scenario.avoidableTokens}`,
      `futureTokens=${scenario.futureTokens}`,
      `reductionPct=${scenario.reductionPct}`,
    ].join(" "));
  }

  if (report.memory) {
    console.log([
      "CODEX_COST_MEMORY",
      `files=${report.memory.files}`,
      `bytes=${report.memory.bytes}`,
      `warnFiles=${report.memory.warnFiles}`,
      `rolloutSummariesSkipped=${report.memory.rolloutSummariesSkipped}`,
      `action=${report.memory.action}`,
    ].join(" "));
    for (const file of report.memory.topFiles.slice(0, 5)) {
      console.log([
        "CODEX_COST_MEMORY_TOP",
        `bytes=${file.bytes}`,
        `warn=${file.warn ? "yes" : "no"}`,
        `path=${fieldValue(file.compactPath)}`,
      ].join(" "));
    }
  }

  const warningRows = [
    ...report.warnings.filter((warning) => warning.type === "missing-local-preflight").slice(0, Math.ceil(DEFAULT_LIMIT / 2)),
    ...report.warnings.filter((warning) => warning.type !== "missing-local-preflight").slice(0, Math.floor(DEFAULT_LIMIT / 2)),
  ].slice(0, DEFAULT_LIMIT);
  for (const warning of warningRows) {
    console.log([
      "CODEX_COST_WARNING",
      `level=${warning.level}`,
      `type=${warning.type}`,
      `tokens=${warning.tokens}`,
      `cwd=${fieldValue(warning.cwdCompact)}`,
    ].join(" "));
  }
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const days = Math.max(1, Number(args.days || DEFAULT_DAYS) || DEFAULT_DAYS);
  const limit = Math.max(1, Number(args.limit || DEFAULT_LIMIT) || DEFAULT_LIMIT);
  const warnTokens = Math.max(1, Number(args["warn-tokens"] || DEFAULT_WARN_TOKENS) || DEFAULT_WARN_TOKENS);
  const urgentTokens = Math.max(warnTokens, Number(args["urgent-tokens"] || DEFAULT_URGENT_TOKENS) || DEFAULT_URGENT_TOKENS);
  const codexHome = args["codex-home"] || DEFAULT_CODEX_HOME;
  const stateRoot = args["state-root"] || DEFAULT_STATE_ROOT;
  const cwdFilter = resolveCwdFilter(args.cwd || "");
  const includeArchived = args["active-only"] ? false : DEFAULT_INCLUDE_ARCHIVED || Boolean(args["include-archived"]);

  const { sessions, cacheStats } = await loadRecentSessions({
    codexHome,
    days,
    includeArchived,
    stateRoot,
    useCache: !args["no-cache"],
  });
  const filteredSessions = cwdFilter ? sessions.filter((session) => path.resolve(session.cwd || "") === cwdFilter) : sessions;
  const report = buildReport({ sessions: filteredSessions, days, warnTokens, urgentTokens, limit });
  if (cwdFilter) report.cwdFilter = cwdFilter;
  report.includeArchived = includeArchived;
  report.memory = scanMemoryBait();
  report.cacheStats = cacheStats;
  const receiptPath = writeReport(report, stateRoot);

  if (args.json) console.log(JSON.stringify({ ...report, receiptPath }, null, 2));
  else printCompact(report, receiptPath);
  return 0;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().then((code) => process.exit(code)).catch((error) => {
    console.error(error.stack || error.message);
    process.exit(1);
  });
}

export {
  buildReport,
  groupByCwd,
  hasLocalPreflight,
  parseArgs,
  writeReport,
};
