const SERVICES = [
  ["adguard", "DNS"],
  ["homebridge", "Homebridge"],
  ["tailscale", "Tailscale"],
  ["internet", "Internet"],
  ["openclaw", "OpenClaw"]
];

const REFRESH_MS = 420000;
let currentHealth = null;

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
  needs.forEach(item => {
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
    explain.textContent = "Explain";
    explain.addEventListener("click", () => askTeddy({
      action: "explain",
      prompt: `Explain this Homebase review item: ${item}`,
      clicked: { type: "review", label: item }
    }));
    const prepare = document.createElement("button");
    prepare.className = "ask-mini";
    prepare.type = "button";
    prepare.textContent = "Prepare fix";
    prepare.addEventListener("click", () => askTeddy({
      action: "prepare-fix",
      prompt: `Prepare a dry-run fix plan for this Homebase review item. Do not run commands or change settings: ${item}`,
      clicked: { type: "review", label: item }
    }));
    chip.append(explain, prepare);
    list.append(chip);
  });
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
  rankItems(houseState.zones, zone => zone.state).forEach(zone => {
    const card = document.createElement("article");
    card.className = `house-zone-card ${stateClass(zone.state)}`;
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
  if (!incident) {
    ribbon.hidden = true;
    return;
  }
  const title = document.getElementById("incident-title");
  const detail = document.getElementById("incident-detail");
  if (title) title.textContent = incident.title || "Mac mini needs review";
  if (detail) detail.textContent = incident.detail || "System evidence needs review.";
  ribbon.hidden = false;
}

function primaryAction(needs) {
  if (!Array.isArray(needs) || needs.length === 0) return "Clear for now.";
  const first = String(needs[0] || "review item").split(":")[0].trim().toLowerCase();
  return first ? `Start with ${first}.` : "Start with the first review item.";
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
  if (value === "live") return "Live";
  return "";
}

function renderConfidence(signal) {
  const label = confidenceLabel(signal);
  if (!label || label === "Live") return null;
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
  const nextAction = houseState && houseState.primaryAction ? houseState.primaryAction : primaryAction(data.needsDan);

  scoreText.textContent = `${score}`;
  ring.style.background = `conic-gradient(var(--green) ${score * 3.6}deg, rgba(255, 255, 255, 0.10) 0deg)`;
  last.textContent = fmtCheckedAt(data.checkedAt);

  if (houseState && houseState.headline) {
    title.textContent = houseState.headline;
    copy.textContent = houseState.summary || "House state is derived from live evidence.";
    next.textContent = nextAction;
    teddyLine.textContent = houseState.tone === "steady" ? "Dan's house is steady." : nextAction;
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
}

function setLoadedState(isLoaded) {
  document.body.classList.toggle("homebase-loading", !isLoaded);
}

async function loadHealth() {
  const button = document.getElementById("refresh-button");
  button.disabled = true;
  button.textContent = "Refreshing";
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
    renderServices(data);
    renderVitals(data.vitals || {});
    renderSignals(data.intelligence);
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

function setAskState(state, text) {
  const pill = document.getElementById("ask-state");
  const response = document.getElementById("ask-response");
  if (pill) pill.textContent = state;
  if (response && text !== undefined) response.textContent = text;
}

async function askTeddy({ action = "ask", prompt = "", clicked = null } = {}) {
  const input = document.getElementById("ask-input");
  const submit = document.getElementById("ask-submit");
  const statusButton = document.getElementById("ask-status-button");
  const finalPrompt = (prompt || input.value || "").trim();
  if (!finalPrompt && action !== "status") {
    setAskState("Ready", "Ask a question first.");
    input.focus();
    return;
  }

  submit.disabled = true;
  statusButton.disabled = true;
  if (!currentHealth) {
    setAskState("Refreshing", "Checking the house first...");
    await loadHealth();
  }
  setAskState("Asking", "Sending the current dashboard context to Teddy...");

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
        context: currentHealth
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
    setAskState(answerState, data.answer || "Teddy answered, but no text came back.");
    if (input && action !== "status") input.value = "";
  } catch (err) {
    const message = err.name === "AbortError"
      ? "Teddy took too long. Refresh and try again; the dashboard is still live."
      : err.message;
    setAskState("Failed", message);
  } finally {
    clearTimeout(timer);
    submit.disabled = false;
    statusButton.disabled = false;
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
