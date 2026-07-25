(function() {
  const stateRank = { bad: 0, warn: 1, info: 2, ok: 3 };
  const params = new URLSearchParams(window.location.search);
  const currentFocus = params.get('focus') || '';
  const currentReview = params.get('review') || '';

  const elements = {
    refresh: document.getElementById('logs-refresh'),
    lastCheck: document.getElementById('logs-last-check'),
    summaryTitle: document.getElementById('logs-summary-title'),
    summaryCopy: document.getElementById('logs-summary-copy'),
    health: document.getElementById('logs-health'),
    healthLabel: document.getElementById('logs-health-label'),
    backLink: document.getElementById('logs-back-link'),
    nextAction: document.getElementById('logs-next-action'),
    state: document.getElementById('logs-state'),
    teddyLine: document.getElementById('logs-teddy-line'),
    sourceGrid: document.getElementById('log-source-grid')
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
    return 'Clear';
  }

  function focusMatches(item) {
    if (!currentFocus) return false;
    const focus = currentFocus.toLowerCase();
    const haystack = `${item.name || ''} ${item.source || ''} ${item.detail || ''}`.toLowerCase();
    if (focus === 'homebridge') return /homebridge|govee|eufy|accessor|automation/.test(haystack);
    if (focus === 'system') return /system|diagnostic|panic|watchdog|kernel|windowserver/.test(haystack);
    if (focus === 'hermes' || focus === 'openclaw') return /hermes|openclaw|gateway|homebase/.test(haystack);
    if (focus === 'network') return /network|dns|adguard|tailscale|wan|internet/.test(haystack);
    if (focus === 'tailscale') return /tailscale|funnel|public|route/.test(haystack);
    return haystack.includes(focus);
  }

  function focusLabel() {
    if (currentFocus === 'homebridge') return 'Homebridge evidence is first.';
    if (currentFocus === 'system') return 'Mac system evidence is first.';
    if (currentFocus === 'hermes' || currentFocus === 'openclaw') return 'Hermes evidence is first.';
    if (currentFocus === 'network') return 'Network evidence is first.';
    if (currentFocus === 'tailscale') return 'Tailscale evidence is first.';
    return currentFocus ? 'Matching evidence is first.' : '';
  }

  function renderSources(items) {
    elements.sourceGrid.textContent = '';
    const sorted = [...items].sort((a, b) => {
      const byFocus = Number(focusMatches(b)) - Number(focusMatches(a));
      if (byFocus) return byFocus;
      if (a.ignored !== b.ignored) return a.ignored ? 1 : -1;
      const byState = (stateRank[a.state] ?? 4) - (stateRank[b.state] ?? 4);
      return byState || text(a.name).localeCompare(text(b.name));
    });

    const quietItems = sorted.filter(item => item.state === 'ok'
      && Number(item.issues) === 0
      && item.ignored !== true
      && !focusMatches(item));
    const visibleItems = quietItems.length > 1
      ? [
          ...sorted.filter(item => !quietItems.includes(item)),
          {
            name: `${quietItems.length} quiet sources`,
            state: 'ok',
            issues: 0,
            rollup: true,
            detail: `${quietItems.map(item => item.name).join(', ')} checked with no recent lines.`,
            examples: []
          }
        ]
      : sorted;

    for (const item of visibleItems) {
      const card = document.createElement('article');
      card.className = `log-source-card ${item.state || 'info'}${item.ignored ? ' ignored' : ''}`;
      if (focusMatches(item)) card.className += ' focused';

      const head = document.createElement('div');
      head.className = 'log-source-head';

      const titleBlock = document.createElement('div');
      const eyebrow = document.createElement('p');
      eyebrow.className = 'eyebrow';
      eyebrow.textContent = item.ignored
        ? 'Ignored source'
        : item.rollup
          ? 'Checked'
          : item.state === 'ok' && Number(item.issues) > 0
            ? 'Below threshold'
            : item.state === 'ok' ? 'Checked' : stateLabel(item.state);
      const title = document.createElement('h4');
      title.textContent = text(item.name, 'Service');
      titleBlock.append(eyebrow, title);

      const count = document.createElement('span');
      count.className = 'state-pill';
      count.textContent = item.rollup
        ? `${quietItems.length} sources`
        : item.issues === null || item.issues === undefined ? 'unknown' : `${item.issues} lines`;
      head.append(titleBlock, count);

      const detail = document.createElement('p');
      detail.className = 'log-source-detail';
      detail.textContent = text(item.detail, 'No detail available.');

      const lines = Array.isArray(item.examples) ? item.examples : [];
      card.append(head, detail);

      if (item.rollup) {
        elements.sourceGrid.append(card);
        continue;
      }

      const operatorDetails = document.createElement('details');
      operatorDetails.className = 'log-operator-details';
      const operatorSummary = document.createElement('summary');
      operatorSummary.textContent = 'Operator details';
      const source = document.createElement('div');
      source.className = 'log-source-path';
      source.textContent = text(item.source, 'source unavailable');
      const examples = document.createElement('div');
      examples.className = 'log-examples';
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
      operatorDetails.append(operatorSummary, source, examples);
      card.append(operatorDetails);
      elements.sourceGrid.append(card);
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
      const logHealth = stateLabel(logs.state);
      elements.lastCheck.textContent = formatTime(logs.checkedAt || data.checkedAt);
      elements.summaryTitle.textContent = logs.state === 'ok'
        ? 'No log source needs action'
        : logs.state === 'warn'
          ? 'Some logs need review'
          : logs.state === 'bad'
            ? 'A log source needs action'
            : 'Log evidence is limited';
      elements.summaryCopy.textContent = text(logs.detail, 'Grouped service log evidence is ready.');
      elements.health.dataset.state = logs.state || 'info';
      elements.health.setAttribute('aria-label', `Log health: ${logHealth}`);
      elements.healthLabel.textContent = logHealth;
      elements.nextAction.textContent = items.some(item => item.state === 'warn' || item.state === 'bad')
        ? 'Start with the top source'
        : `${items.length} sources checked`;
      elements.state.textContent = logs.state === 'ok' ? `${items.length} sources` : stateLabel(logs.state);
      elements.teddyLine.textContent = logs.state === 'ok' ? 'No source needs action.' : 'The loudest source is ranked first.';
      if (currentFocus) elements.teddyLine.textContent = focusLabel();
      renderSources(items);
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
  if (elements.backLink) {
    if (currentReview) {
      elements.backLink.href = `/pages/teddy-house/?review=${encodeURIComponent(currentReview)}#review-lane`;
      elements.backLink.textContent = '← Back to review';
    } else {
      elements.backLink.href = '/pages/teddy-house/';
      elements.backLink.textContent = '← Back to Homebase';
    }
  }
  loadLogs();
})();
