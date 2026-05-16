const SERVICES = [
  ["adguard", "DNS"],
  ["homebridge", "Homebridge"],
  ["tailscale", "Tailscale"],
  ["internet", "Internet"],
  ["openclaw", "OpenClaw"]
];

const REFRESH_MS = 420000;

function stateClass(state) {
  if (state === "ok") return "state-ok";
  if (state === "info") return "state-info";
  if (state === "warn") return "state-warn";
  return "state-bad";
}

function stateLabel(state) {
  if (state === "ok") return "Good";
  if (state === "info") return "Notice";
  if (state === "warn") return "Review";
  return "Issue";
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
  SERVICES.forEach(([key, name]) => {
    const item = services[key] || { state: "warn", detail: "No reading available.", metric: "--" };
    const card = document.createElement("article");
    card.className = "service-card";

    const top = div("service-top");
    const copy = div();
    copy.append(div("service-name", name), div("tiny-label", stateLabel(item.state)));
    top.append(copy, span(`status-dot ${stateClass(item.state)}`));

    const detail = div("service-detail", item.detail || "No detail available.");
    const metric = div("metric-row");
    const strong = document.createElement("strong");
    strong.textContent = item.metric || "--";
    metric.append(span("", item.check || "Checking"), strong);

    card.append(top, detail, metric);
    grid.append(card);
  });
}

function renderVitals(vitals) {
  const grid = document.getElementById("vitals-grid");
  const health = vitals.health || {};
  const rows = [
    ["CPU load", vitals.cpu || "--", health.cpu],
    ["Memory used", vitals.memory || "--", health.memory],
    ["Disk used", vitals.disk || "--", health.disk],
    ["Uptime", vitals.uptime || "--", null],
    ["Network", vitals.network || "--", null],
    ["Host", vitals.host || "--", null]
  ];
  clear(grid);
  rows.forEach(([label, value, signal]) => {
    const item = div("vital");
    const top = div("vital-top");
    top.append(div("tiny-label", label));
    if (signal) top.append(span(`status-dot ${stateClass(signalState(signal))}`));
    item.append(top, div("vital-value", value));
    if (signal && signal.detail) item.title = signal.detail;
    grid.append(item);
  });
}

function renderNeeds(needs) {
  const title = document.getElementById("needs-title");
  const list = document.getElementById("needs-list");
  clear(list);
  if (!needs || needs.length === 0) {
    title.textContent = "No action needed.";
    list.append(span("badge", "Clear"));
    return;
  }
  title.textContent = `${needs.length} item${needs.length === 1 ? "" : "s"} to review.`;
  needs.forEach(item => list.append(span("need-chip", item)));
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

function renderSignalCard(grid, title, signal, label, detailOverride) {
  const item = document.createElement("article");
  item.className = "signal-card";
  const top = div("signal-top");
  const copy = div();
  const value = document.createElement("strong");
  value.textContent = signalValue(signal);
  copy.append(div("tiny-label", title), value);
  top.append(copy, span(`status-dot ${stateClass(signalState(signal))}`));
  item.append(top, div("signal-label", label || (signal && (signal.label || signal.check)) || "Checking"));
  const detail = document.createElement("p");
  detail.textContent = detailOverride || (signal && signal.detail) || "No detail available.";
  item.append(detail);
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

  renderSignalCard(grid, "DNS blocks", data.adguard, data.adguard && data.adguard.label);
  renderSignalCard(grid, "Accessories", homebridge.accessories, "Homebridge");
  renderSignalCard(grid, "Homebridge log", homebridge.logHealth, homebridge.logHealth && homebridge.logHealth.label);
  renderSignalCard(grid, "External access", data.tailscaleFunnel, data.tailscaleFunnel && data.tailscaleFunnel.check);
  renderSignalCard(grid, "WAN quality", data.wanQuality, data.wanQuality && data.wanQuality.check);
  renderSignalCard(grid, "App versions", data.softwareUpdates, data.softwareUpdates && data.softwareUpdates.label);
  renderSignalCard(grid, "macOS", data.macUpdates, data.macUpdates && data.macUpdates.check);
  renderSignalCard(grid, "System logs", data.systemLogs, data.systemLogs && data.systemLogs.check);
  if (weirdFindings.length > 0) {
    const weirdState = weirdFindings.some(item => item.state === "bad")
      ? "bad"
      : weirdFindings.some(item => item.state === "warn")
        ? "warn"
        : "info";
    const weirdDetail = weirdFindings.map(item => `${item.title}: ${item.detail}`).join(" ");
    renderSignalCard(grid, "Changes", { state: weirdState, value: weirdFindings.length }, "Change detection", weirdDetail);
  }
}

function renderEvents(events) {
  const list = document.getElementById("events-list");
  clear(list);
  (events || []).forEach(event => {
    const item = div("event");
    const title = document.createElement("strong");
    title.textContent = event.title || "Update";
    item.append(span("", event.time || fmtAge(event.at)), title, span("", event.detail || "No detail available."));
    list.append(item);
  });
}

function renderSummary(data) {
  const score = data.score ?? 0;
  const needCount = Array.isArray(data.needsDan) ? data.needsDan.length : 0;
  const title = document.getElementById("summary-title");
  const copy = document.getElementById("summary-copy");
  const scoreText = document.getElementById("health-score");
  const ring = document.getElementById("score-ring");
  const next = document.getElementById("next-action");
  const last = document.getElementById("last-check");
  const teddyLine = document.getElementById("teddy-line");

  scoreText.textContent = `${score}`;
  ring.style.background = `conic-gradient(var(--green) ${score * 3.6}deg, rgba(255, 255, 255, 0.10) 0deg)`;
  last.textContent = `Checked ${new Date(data.checkedAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}`;

  if (score >= 90 && needCount === 0) {
    title.textContent = "All core systems are online.";
    copy.textContent = "DNS, Homebridge, Tailscale, OpenClaw, and the Mac mini responded.";
    next.textContent = "No action needed.";
    teddyLine.textContent = "No action needed.";
  } else if (score >= 90) {
    title.textContent = "Core systems are online.";
    copy.textContent = needCount === 1 ? "1 signal needs review." : `${needCount} signals need review.`;
    next.textContent = "Review the flagged item.";
    teddyLine.textContent = "Review recommended.";
  } else if (score >= 70) {
    title.textContent = "Mostly online.";
    copy.textContent = needCount === 1
      ? "Core services are online. 1 signal needs review."
      : `Core services are online. ${needCount} signals need review.`;
    next.textContent = "Review the flagged item.";
    teddyLine.textContent = needCount === 1 ? "1 item to review." : `${needCount} items to review.`;
  } else {
    title.textContent = "A core check needs attention.";
    copy.textContent = "A core check failed from the Mac mini.";
    next.textContent = "Start with the issue.";
    teddyLine.textContent = "Issue detected.";
  }
}

async function loadHealth() {
  const button = document.getElementById("refresh-button");
  button.disabled = true;
  button.textContent = "Refreshing";
  try {
    const res = await fetch("/api/pages/teddy-house/health", { cache: "no-store" });
    if (!res.ok) throw new Error(`Health API returned ${res.status}`);
    const data = await res.json();
    renderSummary(data);
    renderNeeds(data.needsDan);
    renderServices(data);
    renderVitals(data.vitals || {});
    renderSignals(data.intelligence);
    renderEvents(data.timeline || data.events || []);
  } catch (err) {
    document.getElementById("summary-title").textContent = "Could not refresh status.";
    const copy = document.getElementById("summary-copy");
    clear(copy);
    copy.append(span("error-box", err.message));
  } finally {
    button.disabled = false;
    button.textContent = "Refresh";
  }
}

document.getElementById("refresh-button").addEventListener("click", loadHealth);
loadHealth();
setInterval(loadHealth, REFRESH_MS);
