const SERVICES = [
  ["adguard", "AdGuard DNS"],
  ["homebridge", "Homebridge"],
  ["tailscale", "Tailscale"],
  ["internet", "Internet"],
  ["openclaw", "OpenClaw / Teddy"],
  ["backups", "Backups"]
];

const SPARKS = {
  ok: [45, 52, 38, 61, 49, 58, 43, 64],
  info: [42, 46, 44, 48, 43, 47, 45, 49],
  warn: [36, 62, 50, 72, 44, 70, 48, 66],
  bad: [76, 32, 18, 48, 22, 15, 38, 20]
};

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

function renderSparkline(state) {
  const values = SPARKS[state] || SPARKS.warn;
  return `<div class="sparkline" aria-hidden="true">${values.map(v => `<span style="height:${v}%"></span>`).join("")}</div>`;
}

function renderServices(data) {
  const grid = document.getElementById("service-grid");
  const services = data.services || {};
  grid.innerHTML = SERVICES.map(([key, name]) => {
    const item = services[key] || { state: "warn", detail: "No data yet.", metric: "--" };
    return `
      <article class="service-card">
        <div class="service-top">
          <div>
            <div class="service-name">${name}</div>
            <div class="tiny-label">${stateLabel(item.state)}</div>
          </div>
          <span class="status-dot ${stateClass(item.state)}"></span>
        </div>
        <div class="service-detail">${item.detail || "No detail available."}</div>
        ${renderSparkline(item.state)}
        <div class="metric-row">
          <span>${item.check || "Last check"}</span>
          <strong>${item.metric || "--"}</strong>
        </div>
      </article>
    `;
  }).join("");
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
  grid.innerHTML = rows.map(([label, value]) => `
    <div class="vital">
      <div class="tiny-label">${label}</div>
      <div class="vital-value">${value}</div>
    </div>
  `).join("");
}

function renderNeeds(needs) {
  const title = document.getElementById("needs-title");
  const list = document.getElementById("needs-list");
  if (!needs || needs.length === 0) {
    title.textContent = "No action needed right now.";
    list.innerHTML = `<span class="badge">Clear</span>`;
    return;
  }
  title.textContent = `${needs.length} item${needs.length === 1 ? "" : "s"} need attention.`;
  list.innerHTML = needs.map(item => `<span class="need-chip">${item}</span>`).join("");
}

function renderInsights(insights) {
  const title = document.getElementById("teddy-says-title");
  const grid = document.getElementById("insight-grid");
  const data = insights || {};
  title.textContent = data.teddySays || "No read yet.";
  grid.innerHTML = (data.cards || []).map(card => `
    <article class="insight-card">
      <div class="insight-top">
        <div>
          <div class="tiny-label">${card.title || "Signal"}</div>
          <strong>${card.value || "--"}</strong>
        </div>
        <span class="status-dot ${stateClass(card.state || "warn")}"></span>
      </div>
      <div class="insight-label">${card.label || "Current"}</div>
      <p>${card.detail || "No detail available."}</p>
    </article>
  `).join("");
}

function renderEvents(events) {
  const list = document.getElementById("events-list");
  list.innerHTML = (events || []).map(event => `
    <div class="event">
      <span>${event.time}</span>
      <strong>${event.title}</strong>
      <span>${event.detail}</span>
    </div>
  `).join("");
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
    renderEvents(data.events || []);
  } catch (err) {
    document.getElementById("summary-title").textContent = "Teddy could not finish the check.";
    document.getElementById("summary-copy").innerHTML = `<span class="error-box">${err.message}</span>`;
  } finally {
    button.disabled = false;
    button.textContent = "Refresh";
  }
}

document.getElementById("refresh-button").addEventListener("click", loadHealth);
loadHealth();
setInterval(loadHealth, 60000);
