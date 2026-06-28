const SERVICES = [
  ["adguard", "DNS"],
  ["homebridge", "Homebridge"],
  ["tailscale", "Tailscale"],
  ["internet", "Internet"],
  ["openclaw", "OpenClaw"],
  ["teddycam", "TeddyCam"]
];

const REFRESH_MS = 420000;
let currentHealth = null;
let askInFlight = false;

function configureLocalLinks() {
  const hostname = window.location.hostname || "127.0.0.1";
  document.querySelectorAll("[data-local-link]").forEach(link => {
    const path = link.getAttribute("data-local-link") || "/";
    link.href = `http://${hostname}:8081${path}`;
  });
}

function stateClass(state) {
  if (state === "ok") return "state-ok";
  if (state === "info") return "state-info";
  if (state === "warn") return "state-warn";
  return "state-bad";
}

function stateLabel(state) {
  if (state === "ok") return "Online";
  if (state === "info") return "Notice";
  if (state === "warn") return "Review";
  return "Issue";
}

function stateRank(state) {
  if (state === "bad") return 0;
  if (state === "warn") return 1;
  if (state === "info") return 2;
  if (state === "ok") return 3;
  return 4;
}

function rankItems(items, getState) {
  return items
    .map((item, index) => ({ item, index }))
    .sort((a, b) => {
      const rank = stateRank(getState(a.item)) - stateRank(getState(b.item));
      return rank === 0 ? a.index - b.index : rank;
    })
    .map(entry => entry.item);
}

function fmtAge(iso) {
  if (!iso) return "Never";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "Unknown";
  const seconds = Math.max(0, Math.round((Date.now() - date.getTime()) / 1000));
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 48) return `${hours}h ago`;
  return `${Math.round(hours / 24)}d ago`;
}

function fmtCheckedAt(iso) {
  if (!iso) return "Checked unknown";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "Checked unknown";
  return `Checked ${date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}`;
}

function clear(el) {
  el.replaceChildren();
}

function div(className, text) {
  const el = document.createElement("div");
  if (className) el.className = className;
  if (text !== undefined) el.textContent = text;
  return el;
}

function span(className, text) {
  const el = document.createElement("span");
  if (className) el.className = className;
  if (text !== undefined) el.textContent = text;
  return el;
}

function renderServices(data) {
  const grid = document.getElementById("service-grid");
  const services = data.services || {};
  clear(grid);
  rankItems(SERVICES, ([key]) => (services[key] || {}).state).forEach(([key, name]) => {
    const item = services[key] || { state: "warn", detail: "No reading available.", metric: "--" };
    const card = document.createElement("article");
    card.className = "service-card";

    const top = div("service-top");
    const copy = div();
    copy.append(div("service-name", name), div("tiny-label", stateLabel(item.state)));
    top.append(copy, span(`status-dot ${stateClass(item.state)}`));

    const metric = div("metric-row");
    const strong = document.createElement("strong");
    strong.textContent = item.metric || "--";
    metric.append(span("", item.check || "Checking"), strong);

    card.append(top);
    if (item.state !== "ok" && item.detail) card.append(div("service-detail", item.detail));
    card.append(metric);
    grid.append(card);
  });
}

function renderVitals(vitals) {
  const grid = document.getElementById("vitals-grid");
  const health = vitals.health || {};
  const rows = [
    ["CPU load", vitals.cpu || "--", health.cpu],
    ["Memory pressure", vitals.memoryPressure || (health.memory && health.memory.displayMetric) || vitals.memory || "--", health.memory],
    ["Disk used", vitals.disk || "--", health.disk],
    ["Uptime", vitals.uptime || "--", null],
    ["Network", vitals.network || "--", null],
    ["Host", vitals.host || "--", null]
  ];
  clear(grid);
  rankItems(rows, ([, , signal]) => signal ? signalState(signal) : "ok").forEach(([label, value, signal]) => {
    const item = div("vital");
    const top = div("vital-top");
    top.append(div("tiny-label", label));
    if (signal) top.append(span(`status-dot ${stateClass(signalState(signal))}`));
    item.append(top, div("vital-value", value));
    if (signal && signal.secondary) item.append(div("vital-detail", signal.secondary));
    if (signal && signal.detail) item.title = signal.detail;
    grid.append(item);
  });
}

function renderHomeStats(homeStats) {
  const grid = document.getElementById("home-stats-grid");
  const pill = document.getElementById("home-stats-pill");
  if (!grid) return;
  clear(grid);
  const stats = homeStats || {};
  const rows = [
    ["Home time", stats.localTime || "--", stats.localDate || "America/Los_Angeles"],
    ["Inside", stats.insideTemperature || "--", stats.indoorFreshness || stats.freshness || "Homebridge sensor"],
    ["Humidity", stats.humidity || "--", stats.indoorSource || "Homebridge sensor"],
    ["Outside", stats.outsideTemperature || "--", stats.weatherSummary || "Weather fallback"],
    ["Weather", stats.weatherSummary || "--", stats.weatherSource || stats.source || "Weather fallback"]
  ];
  if (pill) pill.textContent = stats.freshness || "Source backed";
  rows.forEach(([label, value, detail]) => {
    const item = div("home-stat-card");
    item.append(div("tiny-label", label), div("home-stat-value", value));
    if (detail) item.append(div("home-stat-detail", detail));
    grid.append(item);
  });
}

function renderNeeds(needs, reviewEvidence) {
  const title = document.getElementById("needs-title");
  const list = document.getElementById("needs-list");
  const lane = document.getElementById("review-lane") || title.closest(".needs-lane");
  const evidenceByLabel = new Map((Array.isArray(reviewEvidence) ? reviewEvidence : []).map(item => [item.label, item]));
  clear(list);
  if (!needs || needs.length === 0) {
    if (lane) lane.hidden = true;
    title.textContent = "Clear for now.";
    return;
  }
  if (lane) lane.hidden = false;
  title.textContent = `${needs.length} item${needs.length === 1 ? "" : "s"} to review.`;
  const compactReview = typeof window !== "undefined"
    && window.matchMedia
    && window.matchMedia("(max-width: 430px)").matches;
  const visibleNeeds = compactReview ? needs.slice(0, 1) : needs;
  visibleNeeds.forEach(item => {
    const evidence = evidenceByLabel.get(item) || null;
    const chip = span("need-chip");
    if (evidence) {
      chip.title = `${evidence.source || "Homebase"} | ${evidence.confidence || "derived"} | ${fmtCheckedAt(evidence.checkedAt)}`;
      chip.dataset.source = evidence.source || "";
      chip.dataset.confidence = evidence.confidence || "";
      chip.dataset.checkedAt = evidence.checkedAt || "";
    }
    chip.append(span("", formatNeedLabel(item)));
    const explain = document.createElement("button");
    explain.className = "ask-mini";
    explain.type = "button";
    explain.textContent = "Ask";
    explain.title = "Explain this review item.";
    explain.setAttribute("aria-label", "Explain this review item");
    explain.addEventListener("click", () => askTeddy({
      action: "explain",
      prompt: `Explain this Homebase review item: ${item}`,
      clicked: { type: "review", label: item }
    }));
    const prepare = document.createElement("button");
    prepare.className = "ask-mini";
    prepare.type = "button";
    prepare.textContent = "Plan";
    prepare.title = "Prepare fix plan.";
    prepare.setAttribute("aria-label", "Prepare fix plan");
    prepare.addEventListener("click", () => askTeddy({
      action: "prepare-fix",
      prompt: `Prepare a dry-run fix plan for this Homebase review item. Do not run commands or change settings: ${item}`,
      clicked: { type: "review", label: item }
    }));
    const logs = document.createElement("a");
    logs.className = "ask-mini need-log-link";
    logs.href = `/pages/teddy-house/logs/?focus=${encodeURIComponent(logFocusForReview(item, evidence))}`;
    logs.textContent = "Logs";
    logs.title = "Open source evidence for this review item.";
    logs.setAttribute("aria-label", "Open logs");
    const capture = document.createElement("button");
    capture.className = "ask-mini";
    capture.type = "button";
    capture.textContent = "Save";
    capture.title = "Save a redacted incident draft for QA.";
    capture.setAttribute("aria-label", "Capture incident");
    capture.addEventListener("click", () => captureIncident({
      title: formatNeedLabel(item),
      clicked: { type: "review", label: item, source: evidence && evidence.source || "" }
    }));
    chip.append(explain, prepare, logs, capture);
    list.append(chip);
  });
  if (compactReview && needs.length > visibleNeeds.length) {
    list.append(span("need-chip need-chip-more", `${needs.length - visibleNeeds.length} more below`));
  }
}

function firstReviewEvidence(health) {
  if (!health || !Array.isArray(health.needsDan) || health.needsDan.length === 0) return null;
  const label = health.needsDan[0];
  const evidence = Array.isArray(health.reviewEvidence)
    ? health.reviewEvidence.find(item => item && item.label === label)
    : null;
  return { label, evidence: evidence || null };
}

function primaryFixTarget(health) {
  if (!health || typeof health !== "object") return null;
  const incident = health.houseState && (health.houseState.incident || (health.houseState.story && health.houseState.story.incident));
  if (incident && (incident.title || incident.nextAction || incident.detail)) {
    return {
      label: incident.title || incident.nextAction || "Homebase review item",
      source: incident.source || "",
      detail: incident.detail || "",
      nextAction: incident.nextAction || (health.houseState && health.houseState.primaryAction) || "",
      evidence: incident
    };
  }
  const first = firstReviewEvidence(health);
  if (!first || !first.label) return null;
  return {
    label: first.label,
    source: first.evidence && first.evidence.source || "",
    detail: first.evidence && first.evidence.detail || "",
    nextAction: health.houseState && health.houseState.primaryAction || "",
    evidence: first.evidence || null
  };
}

function updatePrimaryFixButton(health) {
  const button = document.getElementById("primary-fix-button");
  if (!button) return;
  const target = primaryFixTarget(health);
  const hasReview = Boolean(target && target.label);
  button.disabled = askInFlight || !hasReview;
  button.textContent = askInFlight && hasReview ? "Teddy is planning" : hasReview ? "Ask Teddy to Fix" : "Nothing to fix";
  button.title = hasReview
    ? `Prepare a safe fix plan for ${formatNeedLabel(target.label)}.`
    : "Homebase has no active review item.";
}

function scrollAskIntoView() {
  const panel = document.getElementById("ask-teddy");
  if (panel && panel.scrollIntoView) panel.scrollIntoView({ block: "nearest", behavior: "smooth" });
}

async function askTeddyToFix() {
  if (!currentHealth) {
    setAskState("Refreshing", "Checking the house first...");
    await loadHealth();
  }
  const target = primaryFixTarget(currentHealth);
  if (!target || !target.label) {
    setAskState("Ready", "Nothing needs a fix plan right now.");
    return;
  }
  scrollAskIntoView();
  const actionLine = target.nextAction ? ` Next action: ${target.nextAction}` : "";
  const detailLine = target.detail ? ` Evidence: ${target.detail}` : "";
  await askTeddy({
    action: "prepare-fix",
    prompt: `Prepare a dry-run fix plan for the current first Homebase review item. Do not run commands or change settings: ${target.label}.${actionLine}${detailLine}`,
    clicked: {
      type: "primary-fix",
      label: target.label,
      source: target.source || ""
    }
  });
}

function logFocusForReview(item, evidence) {
  const text = `${item || ""} ${evidence && evidence.source || ""}`.toLowerCase();
  if (/govee|automation|homebridge|accessor|smart-home/.test(text)) return "homebridge";
  if (/system logs|watchdog|panic|restart|mac system/.test(text)) return "system";
  if (/openclaw|gateway|mac mini service/.test(text)) return "openclaw";
  if (/dns|adguard|internet|wan|tailscale|network/.test(text)) return "network";
  if (/public access|external access|funnel|route/.test(text)) return "tailscale";
  return "service";
}

function formatNeedLabel(item) {
  const [rawName, rawValue] = String(item || "").split(":").map(part => part.trim());
  const name = rawName || "Review item";
  const value = rawValue || "";
  if (/mac restart|watchdog|panic/i.test(name)) return "Mac restart incident";
  if (/system logs/i.test(name)) return value ? `Mac system logs: ${value}` : "Mac system logs need review";
  if (/service logs/i.test(name)) return value && !/^\d+$/.test(value) ? value : "Service logs need review";
  if (/external access/i.test(name)) return value ? `Public access: ${value}` : "Public access needs review";
  return value ? `${name}: ${value}` : name;
}

function renderHouseState(houseState) {
  const panel = document.getElementById("house-state");
  const grid = document.getElementById("house-zone-grid");
  const pill = document.getElementById("house-state-pill");
  if (!panel || !grid) return;
  clear(grid);
  if (!houseState || !Array.isArray(houseState.zones)) {
    if (pill) pill.textContent = "Evidence";
    return;
  }
  if (pill) {
    pill.textContent = houseState.tone === "steady"
      ? "Steady"
      : houseState.tone === "issue"
        ? "Issue"
        : "Review";
  }
  houseState.zones.forEach((zone, index) => {
    const card = document.createElement("article");
    card.className = `house-zone-card ${stateClass(zone.state)}${index === 0 ? " active-zone" : ""}`;
    if (index === 0) {
      card.setAttribute("aria-label", `First check: ${zone.title || "House zone"}`);
    }
    const top = div("house-zone-top");
    const copy = div();
    copy.append(div("tiny-label", zone.title || "Zone"), div("house-zone-value", zone.value || "--"));
    top.append(copy, span(`status-dot ${stateClass(zone.state)}`));
    card.append(top);
    const detail = document.createElement("p");
    detail.textContent = zone.detail || "No detail available.";
    card.append(detail);
    const evidence = Array.isArray(zone.evidence) ? zone.evidence.filter(Boolean).slice(0, 4) : [];
    if (evidence.length > 0) {
      const row = div("house-zone-evidence");
      evidence.forEach(item => row.append(span("", item)));
      card.append(row);
    }
    grid.append(card);
  });
}

function renderDailyDecision(decision) {
  const section = document.getElementById("daily-decision");
  if (!section) return;
  const fallback = [
    { key: "now", label: "Now", text: "Nothing needs Dan.", state: "ok" },
    { key: "watch", label: "Watch", text: "House evidence is current.", state: "info" },
    { key: "later", label: "Later", text: "Maintenance can wait.", state: "info" }
  ];
  const slots = Array.isArray(decision && decision.slots) && decision.slots.length === 3 ? decision.slots : fallback;
  slots.forEach(slot => {
    const card = section.querySelector(`[data-decision-slot="${slot.key}"]`);
    if (!card) return;
    card.className = `decision-slot ${stateClass(slot.state)}`;
    const label = card.querySelector(".eyebrow");
    const title = card.querySelector("h3");
    if (label) label.textContent = slot.label || slot.key;
    if (title) title.textContent = slot.text || "No action.";
  });
}

function renderIncident(houseState) {
  const ribbon = document.getElementById("incident-ribbon");
  if (!ribbon) return;
  const incident = houseState && houseState.incident;
  const knownButton = document.getElementById("incident-known-button");
  const meta = document.getElementById("incident-meta");
  if (!incident) {
    ribbon.hidden = true;
    if (knownButton) {
      knownButton.disabled = true;
      delete knownButton.dataset.incidentKey;
    }
    if (meta) clear(meta);
    return;
  }
  const title = document.getElementById("incident-title");
  const detail = document.getElementById("incident-detail");
  if (title) title.textContent = incident.title || "Mac mini needs review";
  if (detail) detail.textContent = incident.detail || "System evidence needs review.";
  renderIncidentMeta(meta, incident);
  if (knownButton) {
    knownButton.disabled = !incident.key;
    knownButton.dataset.incidentKey = incident.key || "";
    knownButton.dataset.known = incident.status === "known" ? "true" : "false";
    knownButton.textContent = incident.status === "known" ? "Track again" : "Mark known";
    knownButton.title = incident.status === "known"
      ? "Move this incident back into normal tracking."
      : "Mark this source-backed incident as known without changing services.";
  }
  ribbon.hidden = false;
}

function renderIncidentMeta(meta, incident) {
  if (!meta) return;
  clear(meta);
  const rows = [
    ["Last seen", incident.lastSeenAt ? fmtCheckedAt(incident.lastSeenAt).replace(/^Checked\s*/i, "") : "current"],
    ["Source", incident.source || "Homebase"],
    ["Confidence", incident.confidence || "derived"],
    ["Next", incident.nextAction || "Review the evidence."]
  ];
  rows.forEach(([label, value]) => {
    const item = span("incident-meta-item");
    item.append(span("incident-meta-label", label), span("incident-meta-value", value));
    meta.append(item);
  });
}

async function markIncidentKnown() {
  const button = document.getElementById("incident-known-button");
  const key = button && button.dataset.incidentKey;
  if (!key) return;
  const known = button.dataset.known !== "true";
  button.disabled = true;
  button.textContent = known ? "Marking" : "Tracking";
  try {
    const res = await fetch(`/api/pages/teddy-house/incidents/${encodeURIComponent(key)}/known`, {
      method: "POST",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ known })
    });
    const data = await res.json();
    if (!res.ok || data.status !== "ok") throw new Error(data.message || data.error || `Incident update returned ${res.status}`);
    await loadHealth();
  } catch (err) {
    setAskState("Incident", err.message || "Could not update incident state.");
    button.disabled = false;
    button.textContent = known ? "Mark known" : "Track again";
  }
}

function primaryAction(needs) {
  if (!Array.isArray(needs) || needs.length === 0) return "Clear for now.";
  const first = String(needs[0] || "review item").split(":")[0].trim().toLowerCase();
  return first ? `Start with ${first}.` : "Start with the first review item.";
}

function priorityDecisionAction(data) {
  const slots = data && data.dailyDecision && Array.isArray(data.dailyDecision.slots)
    ? data.dailyDecision.slots
    : [];
  const now = slots.find(slot => slot && slot.key === "now");
  if (!now || !now.text || !["bad", "warn"].includes(now.state)) return "";
  return now.text;
}

function signalValue(signal, fallback = "--") {
  if (!signal) return fallback;
  if (signal.value !== undefined && signal.value !== null) return String(signal.value);
  if (signal.metric !== undefined && signal.metric !== null) return String(signal.metric);
  if (signal.count !== undefined && signal.count !== null) return String(signal.count);
  return fallback;
}

function signalState(signal) {
  return (signal && signal.state) || "info";
}

function confidenceLabel(signal) {
  const value = signal && signal.confidence;
  if (value === "manual") return "Manual verified";
  if (value === "cached") return "Cached";
  if (value === "degraded") return "Degraded source";
  if (value === "needs-login") return "Needs login";
  if (value === "live") return "Live";
  return "";
}

function shouldShowConfidence(signal) {
  return ["manual", "cached", "degraded", "needs-login"].includes(signal && signal.confidence);
}

function renderConfidence(signal) {
  const label = confidenceLabel(signal);
  if (!label || !shouldShowConfidence(signal)) return null;
  const pill = span(`confidence-pill confidence-${signal.confidence}`, label);
  if (signal.confidenceDetail) pill.title = signal.confidenceDetail;
  return pill;
}

function renderSignalCard(grid, title, signal, label, detailOverride) {
  const item = document.createElement("article");
  item.className = "signal-card";
  const state = signalState(signal);
  const top = div("signal-top");
  const copy = div();
  const value = document.createElement("strong");
  value.textContent = signalValue(signal);
  copy.append(div("tiny-label", title), value);
  top.append(copy, span(`status-dot ${stateClass(state)}`));
  item.append(top);
  const confidence = renderConfidence(signal);
  if (confidence) item.append(confidence);
  if (state !== "ok") {
    item.append(div("signal-label", label || (signal && (signal.label || signal.check)) || "Checking"));
    const detail = document.createElement("p");
    detail.textContent = detailOverride || (signal && signal.detail) || "No detail available.";
    item.append(detail);
  }
  grid.append(item);
}

function renderSignals(intelligence) {
  const grid = document.getElementById("signal-grid");
  if (!grid) return;
  clear(grid);
  const data = intelligence || {};
  const homebridge = data.homebridge || {};
  const weirdItems = Array.isArray(data.weirdThings) ? data.weirdThings : [];
  const weirdFindings = weirdItems.filter(item => item.title !== "No drift" && item.title !== "No new weird thing");

  const cards = [
    ["DNS blocks", data.adguard, data.adguard && data.adguard.label],
    ["Door locks", homebridge.doorLocks, homebridge.doorLocks && homebridge.doorLocks.label],
    ["House devices", homebridge.accessories, "Smart Home"],
    ["Homebridge log", homebridge.logHealth, homebridge.logHealth && homebridge.logHealth.label],
    ["Homebridge version", homebridge.version, homebridge.version && homebridge.version.label],
    ["What's exposed", data.tailscaleFunnel, data.tailscaleFunnel && data.tailscaleFunnel.check],
    ["TeddyCam", data.teddyCam, data.teddyCam && data.teddyCam.check],
    ["Internet", data.wanQuality, data.wanQuality && data.wanQuality.check],
    ["Service logs", data.serviceLogs, data.serviceLogs && data.serviceLogs.label],
    ["App versions", data.softwareUpdates, data.softwareUpdates && data.softwareUpdates.label],
    ["macOS", data.macUpdates, data.macUpdates && data.macUpdates.check],
    ["System logs", data.systemLogs, data.systemLogs && data.systemLogs.check]
  ];
  if (weirdFindings.length > 0) {
    const weirdState = weirdFindings.some(item => item.state === "bad")
      ? "bad"
      : weirdFindings.some(item => item.state === "warn")
        ? "warn"
        : "info";
    const weirdDetail = weirdFindings.map(item => `${item.title}: ${item.detail}`).join(" ");
    cards.push(["Changes", { state: weirdState, value: weirdFindings.length }, "Change detection", weirdDetail]);
  }
  rankItems(cards, ([, signal]) => signalState(signal))
    .filter(([, signal]) => !signal || signal.hidden !== true)
    .forEach(([title, signal, label, detailOverride]) => renderSignalCard(grid, title, signal, label, detailOverride));
}

function renderHistoricalSummaries(summaries) {
  const grid = document.getElementById("history-grid");
  if (!grid) return;
  clear(grid);
  const items = Array.isArray(summaries) ? summaries.filter(summary => summary && summary.source).slice(0, 6) : [];
  items.forEach(summary => {
    const card = document.createElement("article");
    card.className = "history-card";
    const top = div("history-top");
    const copy = div();
    copy.append(div("tiny-label", summary.title || "Memory"), div("history-value", summary.value || "--"));
    const windowLabel = summary.window ? span("history-window", summary.window) : null;
    top.append(copy);
    if (windowLabel) top.append(windowLabel);
    card.append(top);
    if (summary.detail) {
      const detail = document.createElement("p");
      detail.textContent = summary.detail;
      card.append(detail);
    }
    renderHistorySamples(card, summary);
    const meta = div("history-meta");
    meta.append(span("", summary.confidence === "persisted" ? "Persisted" : "Source backed"));
    meta.append(span("", `${summary.sampleCount || 0} sample${Number(summary.sampleCount) === 1 ? "" : "s"}`));
    if (summary.freshness) meta.append(span("", summary.freshness));
    card.title = summary.source;
    card.append(meta);
    grid.append(card);
  });
  if (!grid.children.length) {
    const item = div("history-card quiet-history");
    item.append(div("tiny-label", "Memory"), div("history-value", "No summaries yet"));
    const detail = document.createElement("p");
    detail.textContent = "Homebase will show historical context after persisted evidence exists.";
    item.append(detail);
    grid.append(item);
  }
}

function renderHistorySamples(card, summary) {
  const points = Array.isArray(summary.points) ? summary.points.filter(point => Number.isFinite(Number(point.cpu))).slice(-12) : [];
  if (points.length < 2) return;
  const max = Math.max(...points.map(point => Number(point.cpu) || 0), 1);
  const row = div("history-samples");
  row.setAttribute("aria-label", `${summary.title || "History"} samples from ${summary.source || "persisted evidence"}`);
  points.forEach(point => {
    const bar = span("history-sample");
    const height = Math.max(18, Math.min(100, Math.round(((Number(point.cpu) || 0) / max) * 100)));
    bar.style.height = `${height}%`;
    bar.title = `${Number(point.cpu).toFixed(2)} at ${fmtCheckedAt(point.at).replace(/^Checked\s*/i, "")}`;
    row.append(bar);
  });
  card.append(row);
}

function renderEvents(events) {
  const list = document.getElementById("events-list");
  clear(list);
  (events || [])
    .filter(event => event && event.title !== "Status check" && !/no changes/i.test(event.detail || ""))
    .slice(0, 8)
    .forEach(event => {
    const item = div("event");
    const title = document.createElement("strong");
    title.textContent = event.title || "Update";
    item.append(span("", event.time || fmtAge(event.at)), title, span("", event.detail || "No detail available."));
    list.append(item);
  });
  if (!list.children.length) {
    const item = div("event quiet-event");
    item.append(span("", "Now"), document.createElement("strong"), span("", "No meaningful changes."));
    item.querySelector("strong").textContent = "Quiet";
    list.append(item);
  }
}

function renderSummary(data) {
  const score = data.score ?? 0;
  const houseState = data.houseState;
  const needCount = Array.isArray(data.needsDan) ? data.needsDan.length : 0;
  const title = document.getElementById("summary-title");
  const copy = document.getElementById("summary-copy");
  const scoreText = document.getElementById("health-score");
  const ring = document.getElementById("score-ring");
  const next = document.getElementById("next-action");
  const last = document.getElementById("last-check");
  const teddyLine = document.getElementById("teddy-line");
  const nextAction = priorityDecisionAction(data) || (houseState && houseState.primaryAction ? houseState.primaryAction : primaryAction(data.needsDan));

  scoreText.textContent = `${score}`;
  ring.style.background = `conic-gradient(var(--green) ${score * 3.6}deg, rgba(255, 255, 255, 0.10) 0deg)`;
  last.textContent = fmtCheckedAt(data.checkedAt);

  if (houseState && houseState.headline) {
    title.textContent = houseState.headline;
    copy.textContent = houseState.summary || "House state is derived from live evidence.";
    next.textContent = nextAction;
    teddyLine.textContent = houseState.tone === "steady" ? "Dan's house is steady." : nextAction;
    updatePrimaryFixButton(data);
    return;
  }

  if (score >= 90 && needCount === 0) {
    title.textContent = "Dan's house is steady.";
    copy.textContent = "Internet, automations, public access, and the Mac mini are quiet.";
    next.textContent = "Clear for now.";
    teddyLine.textContent = "Clear for now.";
  } else if (score >= 90) {
    title.textContent = "Something needs a look.";
    copy.textContent = needCount === 1 ? "1 signal needs review." : `${needCount} signals need review.`;
    next.textContent = nextAction;
    teddyLine.textContent = "Review recommended.";
  } else if (score >= 70) {
    title.textContent = "Something needs a look.";
    copy.textContent = needCount === 1
      ? "Core services are online. 1 signal needs review."
      : `Core services are online. ${needCount} signals need review.`;
    next.textContent = nextAction;
    teddyLine.textContent = needCount === 1 ? "1 item to review." : `${needCount} items to review.`;
  } else {
    title.textContent = "Homebase found an issue.";
    copy.textContent = "A core check failed from the Mac mini.";
    next.textContent = "Start with the issue.";
    teddyLine.textContent = "Issue detected.";
  }
  updatePrimaryFixButton(data);
}

function setLoadedState(isLoaded) {
  document.body.classList.toggle("homebase-loading", !isLoaded);
}

function setEvidenceDetailState(data) {
  const isSteady = data && data.houseState && data.houseState.tone === "steady"
    && (!Array.isArray(data.needsDan) || data.needsDan.length === 0);
  document.body.classList.toggle("homebase-steady", Boolean(isSteady));
  [
    ["evidence-details", "evidence-summary", isSteady ? "Show service evidence" : "Service evidence"],
    ["signals-details", "signals-summary", isSteady ? "Show signal evidence" : "Signal evidence"]
  ].forEach(([detailsId, summaryId, label]) => {
    const details = document.getElementById(detailsId);
    const summary = document.getElementById(summaryId);
    if (details) details.open = !isSteady;
    if (summary) summary.textContent = label;
  });
}

async function loadHealth() {
  const button = document.getElementById("refresh-button");
  button.disabled = true;
  button.textContent = "Refreshing";
  updatePrimaryFixButton(null);
  try {
    const res = await fetch("/api/pages/teddy-house/health", { cache: "no-store" });
    if (!res.ok) throw new Error(`Health API returned ${res.status}`);
    const data = await res.json();
    currentHealth = data;
    renderSummary(data);
    renderDailyDecision(data.dailyDecision);
    renderIncident(data.houseState);
    renderNeeds(data.needsDan, data.reviewEvidence);
    renderHouseState(data.houseState);
    renderHomeStats(data.homeStats);
    renderServices(data);
    renderVitals(data.vitals || {});
    renderSignals(data.intelligence);
    setEvidenceDetailState(data);
    renderHistoricalSummaries(data.historicalSummaries);
    renderEvents((data.houseState && data.houseState.recentChanges) || data.timeline || data.events || []);
    setLoadedState(true);
  } catch (err) {
    document.getElementById("summary-title").textContent = "Could not refresh status.";
    const copy = document.getElementById("summary-copy");
    clear(copy);
    copy.append(span("error-box", err.message));
    setLoadedState(false);
  } finally {
    button.disabled = false;
    button.textContent = "Refresh";
  }
}

document.getElementById("refresh-button").addEventListener("click", loadHealth);
document.getElementById("incident-known-button")?.addEventListener("click", markIncidentKnown);
document.getElementById("primary-fix-button")?.addEventListener("click", askTeddyToFix);

function setAskState(state, text, source = "") {
  const pill = document.getElementById("ask-state");
  const response = document.getElementById("ask-response");
  if (pill) {
    pill.textContent = state;
    if (source) pill.dataset.source = source;
    else delete pill.dataset.source;
  }
  if (response) {
    if (source) response.dataset.source = source;
    else delete response.dataset.source;
    response.classList.toggle("is-fallback", source === "local-fallback");
    if (text !== undefined) response.textContent = text;
  }
}

function setAskProgress(phase = "idle", source = "") {
  const progress = document.getElementById("ask-progress");
  if (!progress) return;
  const steps = ["context", "teddy", "approval"];
  const activeIndex = phase === "context" ? 0 : phase === "teddy" ? 1 : phase === "approval" ? 2 : -1;
  const doneThrough = phase === "done" ? 2 : phase === "fallback" ? 2 : phase === "failed" ? 1 : Math.max(-1, activeIndex - 1);
  progress.hidden = phase === "idle";
  progress.dataset.phase = phase;
  if (source) progress.dataset.source = source;
  else delete progress.dataset.source;
  steps.forEach((key, index) => {
    const step = progress.querySelector(`[data-ask-step="${key}"]`);
    if (!step) return;
    step.classList.toggle("is-active", index === activeIndex);
    step.classList.toggle("is-done", index <= doneThrough);
    step.classList.toggle("is-warn", phase === "fallback" && key === "teddy");
    step.classList.toggle("is-failed", phase === "failed" && key === "teddy");
  });
}

function compactSignal(signal) {
  if (!signal || typeof signal !== "object") return null;
  return {
    state: signal.state || null,
    metric: signal.metric || signal.value || signal.count || null,
    label: signal.label || signal.check || null,
    detail: signal.detail || null,
    source: signal.source || signal.check || null,
    confidence: signal.confidence || null
  };
}

function compactHouseState(houseState) {
  if (!houseState || typeof houseState !== "object") return null;
  const incident = houseState.incident || (houseState.story && houseState.story.incident) || null;
  return {
    headline: houseState.headline || null,
    summary: houseState.summary || null,
    tone: houseState.tone || null,
    primaryAction: houseState.primaryAction || null,
    incident: incident ? {
      title: incident.title || null,
      source: incident.source || null,
      detail: incident.detail || null,
      nextAction: incident.nextAction || null,
      status: incident.status || null
    } : null,
    zones: Array.isArray(houseState.zones)
      ? houseState.zones.slice(0, 4).map(zone => ({
          id: zone.id || null,
          title: zone.title || null,
          state: zone.state || null,
          value: zone.value || null,
          detail: zone.detail || null
        }))
      : []
  };
}

function contextForAsk(health) {
  if (!health || typeof health !== "object") return null;
  const intelligence = health.intelligence || {};
  const homebridge = intelligence.homebridge || {};
  const vitals = health.vitals || {};
  const healthVitals = vitals.health || {};
  return {
    checkedAt: health.checkedAt,
    score: health.score,
    needsDan: Array.isArray(health.needsDan) ? health.needsDan.slice(0, 3) : [],
    reviewEvidence: Array.isArray(health.reviewEvidence)
      ? health.reviewEvidence.slice(0, 3).map(item => ({
          label: item.label || null,
          source: item.source || null,
          confidence: item.confidence || null,
          detail: item.detail || null
        }))
      : [],
    houseState: compactHouseState(health.houseState),
    dailyDecision: health.dailyDecision && Array.isArray(health.dailyDecision.slots)
      ? { tone: health.dailyDecision.tone || null, slots: health.dailyDecision.slots.slice(0, 3) }
      : null,
    services: Object.fromEntries(Object.entries(health.services || {}).map(([key, value]) => [key, compactSignal(value)])),
    intelligence: {
      publicAccess: compactSignal(intelligence.publicAccess),
      tailscaleFunnel: compactSignal(intelligence.tailscaleFunnel),
      wanQuality: compactSignal(intelligence.wanQuality),
      networkLogs: compactSignal(intelligence.networkLogs),
      systemLogs: compactSignal(intelligence.systemLogs),
      macUpdates: compactSignal(intelligence.macUpdates),
      softwareUpdates: compactSignal(intelligence.softwareUpdates),
      homebridge: {
        logHealth: compactSignal(homebridge.logHealth),
        version: compactSignal(homebridge.version),
        accessories: compactSignal(homebridge.accessories)
      }
    },
    historicalSummaries: Array.isArray(health.historicalSummaries)
      ? health.historicalSummaries.slice(0, 2).map(summary => ({
          title: summary.title || null,
          window: summary.window || null,
          value: summary.value || null,
          source: summary.source || null
        }))
      : [],
    vitals: {
      cpu: vitals.cpu || null,
      memoryPressure: vitals.memoryPressure || vitals.memory || null,
      disk: vitals.disk || null,
      uptime: vitals.uptime || null,
      health: {
        cpu: compactSignal(healthVitals.cpu),
        memory: compactSignal(healthVitals.memory),
        disk: compactSignal(healthVitals.disk)
      }
    },
    homeStats: health.homeStats ? {
      localTime: health.homeStats.localTime || null,
      insideTemperature: health.homeStats.insideTemperature || null,
      humidity: health.homeStats.humidity || null,
      outsideTemperature: health.homeStats.outsideTemperature || null,
      weatherSummary: health.homeStats.weatherSummary || null,
      source: health.homeStats.source || null,
      freshness: health.homeStats.freshness || null
    } : null
  };
}

async function askTeddy({ action = "ask", prompt = "", clicked = null } = {}) {
  const input = document.getElementById("ask-input");
  const submit = document.getElementById("ask-submit");
  const statusButton = document.getElementById("ask-status-button");
  const primaryFixButton = document.getElementById("primary-fix-button");
  const finalPrompt = (prompt || input.value || "").trim();
  if (!finalPrompt && action !== "status") {
    setAskState("Ready", "Ask a question first.");
    input.focus();
    return;
  }

  askInFlight = true;
  submit.disabled = true;
  statusButton.disabled = true;
  if (primaryFixButton) primaryFixButton.disabled = true;
  updatePrimaryFixButton(currentHealth);
  setAskProgress("context");
  if (!currentHealth) {
    setAskState("Refreshing", "Checking the house first...");
    await loadHealth();
  }
  if (action === "prepare-fix") {
    scrollAskIntoView();
    setAskState("Planning", "Preparing a safe fix plan...");
  } else {
    setAskState("Asking", "Sending the current dashboard context to Teddy...");
  }
  setAskProgress("teddy");

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 75000);
  try {
    const res = await fetch("/api/pages/teddy-house/ask", {
      method: "POST",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
      signal: controller.signal,
      body: JSON.stringify({
        action,
        prompt: finalPrompt,
        clicked,
        context: contextForAsk(currentHealth)
      })
    });
    const data = await res.json();
    if (!res.ok || data.status === "error") throw new Error(data.message || data.error || `Ask Teddy returned ${res.status}`);
    const answerState = data.source === "local-fallback"
      ? "Fallback"
      : data.source === "local"
        ? "Local"
        : data.status === "complete"
          ? "Answered"
          : "Done";
    const answerText = data.source === "local-fallback" && !/Teddy bridge/i.test(data.answer || "")
      ? `Teddy bridge needs attention. ${data.answer || "I used the dashboard context instead."}`
      : data.answer || "Teddy answered, but no text came back.";
    setAskProgress(data.source === "local-fallback" ? "fallback" : "done", data.source || "");
    setAskState(answerState, answerText, data.source || "");
    document.getElementById("ask-response")?.focus?.();
    if (input && action !== "status") input.value = "";
  } catch (err) {
    const message = err.name === "AbortError"
      ? "Teddy took too long. Refresh and try again; the dashboard is still live."
      : err.message;
    setAskProgress("failed");
    setAskState("Failed", message);
  } finally {
    clearTimeout(timer);
    askInFlight = false;
    submit.disabled = false;
    statusButton.disabled = false;
    updatePrimaryFixButton(currentHealth);
  }
}

async function captureIncident({ title = "Homebase incident", clicked = null } = {}) {
  if (!currentHealth) {
    setAskState("Refreshing", "Checking the house first...");
    await loadHealth();
  }
  setAskState("Capturing", "Saving a redacted incident draft...");
  try {
    const res = await fetch("/api/pages/teddy-house/incidents/capture", {
      method: "POST",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title,
        clicked,
        context: currentHealth,
        checkedAt: currentHealth && currentHealth.checkedAt
      })
    });
    const data = await res.json();
    if (!res.ok || data.status !== "ok") throw new Error(data.message || data.error || `Capture returned ${res.status}`);
    setAskState("Captured", `Saved redacted incident draft ${data.id}.`);
  } catch (err) {
    setAskState("Failed", err.message || "Incident capture failed.");
  }
}

document.getElementById("ask-form").addEventListener("submit", (event) => {
  event.preventDefault();
  askTeddy({ action: "ask" });
});

document.getElementById("ask-status-button").addEventListener("click", () => {
  askTeddy({ action: "status", prompt: "Summarize the current Homebase status and explain what needs review." });
});

configureLocalLinks();
loadHealth();
setInterval(loadHealth, REFRESH_MS);
