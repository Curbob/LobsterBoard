const SERVICES = [
  ["adguard", "AdGuard DNS"],
  ["homebridge", "Homebridge"],
  ["tailscale", "Tailscale"],
  ["internet", "Internet"],
  ["openclaw", "OpenClaw / Teddy"],
  ["backups", "Backups"]
];

const REFRESH_MS = 420000;

function stateClass(state) {
  if (state === "ok") return "state-ok";
  if (state === "info") return "state-info";
  if (state === "warn") return "state-warn";
  return "state-bad";
}

function stateLabel(state) {
  if (state === "ok") return "Healthy";
  if (state === "info") return "Parked";
  if (state === "warn") return "Watch";
  return "Fix";
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
    const item = services[key] || { state: "warn", detail: "No data yet.", metric: "--" };
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
    metric.append(span("", item.check || "Last check"), strong);

    card.append(top, detail, metric);
    grid.append(card);
  });
}

function renderVitals(vitals) {
  const grid = document.getElementById("vitals-grid");
  const rows = [
    ["CPU load", vitals.cpu || "--"],
    ["Memory", vitals.memory || "--"],
    ["Disk", vitals.disk || "--"],
    ["Uptime", vitals.uptime || "--"],
    ["Network", vitals.network || "--"],
    ["Host", vitals.host || "--"]
  ];
  clear(grid);
  rows.forEach(([label, value]) => {
    const item = div("vital");
    item.append(div("tiny-label", label), div("vital-value", value));
    grid.append(item);
  });
}

function renderNeeds(needs) {
  const title = document.getElementById("needs-title");
  const list = document.getElementById("needs-list");
  clear(list);
  if (!needs || needs.length === 0) {
    title.textContent = "No action needed right now.";
    list.append(span("badge", "Clear"));
    return;
  }
  title.textContent = `${needs.length} item${needs.length === 1 ? "" : "s"} need attention.`;
  needs.forEach(item => list.append(span("need-chip", item)));
}

function renderInsights(insights) {
  const title = document.getElementById("teddy-says-title");
  const grid = document.getElementById("insight-grid");
  const data = insights || {};
  title.textContent = data.teddySays || "No read yet.";
  clear(grid);
  (data.cards || []).forEach(card => {
    const item = document.createElement("article");
    item.className = "insight-card";
    const top = div("insight-top");
    const metric = div();
    const value = document.createElement("strong");
    value.textContent = card.value || "--";
    metric.append(div("tiny-label", card.title || "Signal"), value);
    top.append(metric, span(`status-dot ${stateClass(card.state || "warn")}`));
    const detail = document.createElement("p");
    detail.textContent = card.detail || "No detail available.";
    item.append(top, div("insight-label", card.label || "Current"), detail);
    grid.append(item);
  });
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
  item.append(top, div("signal-label", label || (signal && (signal.label || signal.check)) || "Current"));
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
  const weirdFindings = weirdItems.filter(item => item.title !== "No new weird thing");
  const weirdState = weirdFindings.some(item => item.state === "bad")
    ? "bad"
    : weirdFindings.some(item => item.state === "warn")
      ? "warn"
      : weirdFindings.some(item => item.state === "info")
        ? "info"
        : "ok";
  const weirdDetail = weirdFindings.length
    ? weirdFindings.map(item => `${item.title}: ${item.detail}`).join(" ")
    : weirdItems.length
      ? weirdItems[0].detail
    : "No change detector read yet.";

  renderSignalCard(grid, "AdGuard blocks", data.adguard, data.adguard && data.adguard.label);
  renderSignalCard(grid, "Homebridge accessories", homebridge.accessories, "cached accessories");
  renderSignalCard(grid, "Homebridge logs", homebridge.logHealth, homebridge.logHealth && homebridge.logHealth.label);
  renderSignalCard(grid, "Public Funnel", data.tailscaleFunnel, data.tailscaleFunnel && data.tailscaleFunnel.check);
  renderSignalCard(grid, "WAN quality", data.wanQuality, data.wanQuality && data.wanQuality.check);
  renderSignalCard(grid, "Software updates", data.softwareUpdates, data.softwareUpdates && data.softwareUpdates.label);
  renderSignalCard(grid, "Weird detector", { state: weirdState, value: weirdFindings.length }, "change detector", weirdDetail);
}

function renderEvents(events) {
  const list = document.getElementById("events-list");
  clear(list);
  (events || []).forEach(event => {
    const item = div("event");
    const title = document.createElement("strong");
    title.textContent = event.title || "Event";
    item.append(span("", event.time || fmtAge(event.at)), title, span("", event.detail || "No detail available."));
    list.append(item);
  });
}

function renderSummary(data) {
  const score = data.score ?? 0;
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

  if (score >= 90) {
    title.textContent = "House systems are online.";
    copy.textContent = "DNS, Homebridge, Tailscale, OpenClaw, and the Mac mini are passing the checks that matter.";
    next.textContent = "Next action: none.";
    teddyLine.textContent = "All quiet. House looks good.";
  } else if (score >= 70) {
    title.textContent = "House systems are mostly online.";
    copy.textContent = "The core path is up, but one check is asking for attention.";
    next.textContent = "Next action: check Needs Dan.";
    teddyLine.textContent = "Mostly good. One item needs eyes.";
  } else {
    title.textContent = "A core system needs attention.";
    copy.textContent = "One or more checks failed from the Mac mini. Start with Needs Dan.";
    next.textContent = "Next action: fix the first red item.";
    teddyLine.textContent = "I found something real.";
  }
}

async function loadHealth() {
  const button = document.getElementById("refresh-button");
  button.disabled = true;
  button.textContent = "Checking";
  try {
    const res = await fetch("/api/pages/teddy-house/health", { cache: "no-store" });
    if (!res.ok) throw new Error(`Health API returned ${res.status}`);
    const data = await res.json();
    renderSummary(data);
    renderNeeds(data.needsDan);
    renderInsights(data.insights);
    renderServices(data);
    renderVitals(data.vitals || {});
    renderSignals(data.intelligence);
    renderEvents(data.timeline || data.events || []);
  } catch (err) {
    document.getElementById("summary-title").textContent = "Teddy could not finish the check.";
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
