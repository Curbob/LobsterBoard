(function() {
  const stateRank = { bad: 0, warn: 1, info: 2, ok: 3 };

  const elements = {
    refresh: document.getElementById('logs-refresh'),
    lastCheck: document.getElementById('logs-last-check'),
    summaryTitle: document.getElementById('logs-summary-title'),
    summaryCopy: document.getElementById('logs-summary-copy'),
    score: document.getElementById('logs-score'),
    scoreRing: document.getElementById('logs-score-ring'),
    nextAction: document.getElementById('logs-next-action'),
    state: document.getElementById('logs-state'),
    teddyLine: document.getElementById('logs-teddy-line'),
    sourceGrid: document.getElementById('log-source-grid'),
    codexTake: document.getElementById('codex-take'),
    teddyTake: document.getElementById('teddy-take'),
    frameworkGrid: document.getElementById('framework-grid')
  };

  function text(value, fallback = '--') {
    return value === undefined || value === null || value === '' ? fallback : String(value);
  }

  function formatTime(value) {
    const date = value ? new Date(value) : null;
    if (!date || Number.isNaN(date.getTime())) return 'Checked unknown';
    return `Checked ${date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}`;
  }

  function stateLabel(state) {
    if (state === 'bad') return 'Needs action';
    if (state === 'warn') return 'Review';
    if (state === 'info') return 'FYI';
    return 'Quiet';
  }

  function scoreFor(items) {
    if (items.some(item => item.state === 'bad')) return 40;
    if (items.some(item => item.state === 'warn')) return 72;
    if (items.some(item => item.state === 'info' && !item.ignored)) return 90;
    return 100;
  }

  function renderSources(items) {
    elements.sourceGrid.textContent = '';
    const sorted = [...items].sort((a, b) => {
      if (a.ignored !== b.ignored) return a.ignored ? 1 : -1;
      const byState = (stateRank[a.state] ?? 4) - (stateRank[b.state] ?? 4);
      return byState || text(a.name).localeCompare(text(b.name));
    });

    for (const item of sorted) {
      const card = document.createElement('article');
      card.className = `log-source-card ${item.state || 'info'}${item.ignored ? ' ignored' : ''}`;

      const head = document.createElement('div');
      head.className = 'log-source-head';

      const titleBlock = document.createElement('div');
      const eyebrow = document.createElement('p');
      eyebrow.className = 'eyebrow';
      eyebrow.textContent = item.ignored ? 'Ignored source' : stateLabel(item.state);
      const title = document.createElement('h4');
      title.textContent = text(item.name, 'Service');
      titleBlock.append(eyebrow, title);

      const count = document.createElement('span');
      count.className = 'state-pill';
      count.textContent = item.issues === null || item.issues === undefined ? 'unknown' : `${item.issues} lines`;
      head.append(titleBlock, count);

      const detail = document.createElement('p');
      detail.className = 'log-source-detail';
      detail.textContent = text(item.detail, 'No detail available.');

      const source = document.createElement('div');
      source.className = 'log-source-path';
      source.textContent = text(item.source, 'source unavailable');

      const examples = document.createElement('div');
      examples.className = 'log-examples';
      const lines = Array.isArray(item.examples) ? item.examples : [];
      if (lines.length > 0) {
        for (const line of lines) {
          const row = document.createElement('code');
          row.textContent = line;
          examples.append(row);
        }
      } else {
        const quiet = document.createElement('span');
        quiet.textContent = 'No notable recent lines.';
        examples.append(quiet);
      }

      card.append(head, detail, source, examples);
      elements.sourceGrid.append(card);
    }
  }

  function renderFramework(framework) {
    elements.codexTake.textContent = text(framework.codexTake, 'Normalize first. Escalate only when the evidence earns it.');
    elements.teddyTake.textContent = text(framework.teddyTake, 'Keep the daily page calm and make the evidence easy to reach.');
    elements.frameworkGrid.textContent = '';
    for (const step of framework.architecture || []) {
      const item = document.createElement('article');
      item.className = 'framework-step';
      const title = document.createElement('h4');
      title.textContent = text(step.layer, 'Layer');
      const detail = document.createElement('p');
      detail.textContent = text(step.detail, 'No detail available.');
      item.append(title, detail);
      elements.frameworkGrid.append(item);
    }
  }

  async function loadLogs() {
    elements.refresh.disabled = true;
    elements.state.textContent = 'Checking';
    try {
      const res = await fetch('/api/pages/teddy-house/logs', { cache: 'no-store' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      const logs = data.serviceLogs || {};
      const items = Array.isArray(logs.items) ? logs.items : [];
      const score = scoreFor(items.filter(item => item.ignored !== true));
      elements.lastCheck.textContent = formatTime(logs.checkedAt || data.checkedAt);
      elements.summaryTitle.textContent = logs.state === 'ok'
        ? 'Service logs are quiet'
        : logs.state === 'warn'
          ? 'Some logs need review'
          : logs.state === 'bad'
            ? 'A log source needs action'
            : 'Log evidence is limited';
      elements.summaryCopy.textContent = text(logs.detail, 'Grouped service log evidence is ready.');
      elements.score.textContent = score;
      elements.scoreRing.style.setProperty('--score', `${score}%`);
      elements.nextAction.textContent = items.some(item => item.state === 'warn' || item.state === 'bad')
        ? 'Start with the top source'
        : 'No noisy source';
      elements.state.textContent = stateLabel(logs.state);
      elements.teddyLine.textContent = logs.state === 'ok' ? 'The log room is quiet.' : 'The loudest source is ranked first.';
      renderSources(items);
      renderFramework(data.framework || {});
    } catch (err) {
      elements.summaryTitle.textContent = 'Could not load logs';
      elements.summaryCopy.textContent = `The log detail API did not answer: ${err.message}.`;
      elements.state.textContent = 'Offline';
      elements.teddyLine.textContent = 'Log detail needs a retry.';
    } finally {
      elements.refresh.disabled = false;
    }
  }

  elements.refresh.addEventListener('click', loadLogs);
  loadLogs();
})();
