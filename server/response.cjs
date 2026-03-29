function sendResponse(res, statusCode, contentType, data, extraHeaders = {}) {
  res.writeHead(statusCode, { 'Content-Type': contentType, ...extraHeaders });
  res.end(data);
}

function sendJson(res, statusCode, data) {
  sendResponse(res, statusCode, 'application/json', JSON.stringify(data), { 'Access-Control-Allow-Origin': '*' });
}

function sendError(res, message, statusCode = 500) {
  sendJson(res, statusCode, { status: 'error', message });
}

function parseIcal(text, maxEvents) {
  const now = new Date();
  const events = [];
  const unfolded = text.replace(/\r?\n[ \t]/g, '');
  const blocks = unfolded.split('BEGIN:VEVENT');
  for (let i = 1; i < blocks.length; i++) {
    const block = blocks[i].split('END:VEVENT')[0];
    if (!block) continue;
    const get = (key) => { const m = block.match(new RegExp('^' + key + '(?:;[^:]*)?:(.*)$', 'm')); return m ? m[1].trim() : ''; };
    const getWithParams = (key) => { const m = block.match(new RegExp('^' + key + '((?:;[^:]*)?):(.*)$', 'm')); return m ? { params: m[1], value: m[2].trim() } : { params: '', value: '' }; };
    const summary = get('SUMMARY').replace(/\\,/g, ',').replace(/\\n/g, ' ');
    const location = get('LOCATION').replace(/\\,/g, ',').replace(/\\n/g, ' ');
    const dtstart = get('DTSTART');
    const dtstartFull = getWithParams('DTSTART');
    const dtendFull = getWithParams('DTEND');
    if (!dtstart) continue;
    const allDay = dtstart.length === 8;
    const tzOffsets = {
      'eastern standard time': -5, 'eastern daylight time': -4, 'us/eastern': -5, 'america/new_york': -5,
      'central standard time': -6, 'central daylight time': -5, 'us/central': -6, 'america/chicago': -6,
      'central america standard time': -6,
      'mountain standard time': -7, 'mountain daylight time': -6, 'us/mountain': -7, 'america/denver': -7,
      'pacific standard time': -8, 'pacific daylight time': -7, 'us/pacific': -8, 'america/los_angeles': -8,
      'pacific standard time (mexico)': -8,
      'india standard time': 5.5, 'asia/kolkata': 5.5,
      'sri lanka standard time': 5.5,
      'singapore standard time': 8, 'asia/singapore': 8,
      'china standard time': 8, 'asia/shanghai': 8,
      'tokyo standard time': 9, 'asia/tokyo': 9,
      'e. africa standard time': 3,
      'romance standard time': 1,
      'gmt standard time': 0, 'utc': 0, 'gmt': 0,
      'w. europe standard time': 1, 'europe/berlin': 1, 'europe/paris': 1,
    };
    const parseIcalDate = (s, params) => {
      if (!s) return null;
      if (s.length === 8) return new Date(s.slice(0,4) + '-' + s.slice(4,6) + '-' + s.slice(6,8) + 'T00:00:00');
      const d = s.replace(/Z$/, '');
      const iso = d.slice(0,4) + '-' + d.slice(4,6) + '-' + d.slice(6,8) + 'T' + d.slice(9,11) + ':' + d.slice(11,13) + ':' + d.slice(13,15);
      if (s.endsWith('Z')) return new Date(iso + 'Z');
      const tzMatch = (params || '').match(/TZID=([^;:]+)/i);
      if (tzMatch) {
        const tzName = tzMatch[1].trim().toLowerCase();
        const offsetHours = tzOffsets[tzName];
        if (offsetHours !== undefined) {
          const sign = offsetHours >= 0 ? '+' : '-';
          const absH = Math.floor(Math.abs(offsetHours));
          const absM = Math.round((Math.abs(offsetHours) - absH) * 60);
          const offsetStr = sign + String(absH).padStart(2, '0') + ':' + String(absM).padStart(2, '0');
          return new Date(iso + offsetStr);
        }
      }
      return new Date(iso);
    };
    const start = parseIcalDate(dtstart, dtstartFull.params);
    const end = parseIcalDate(dtendFull.value, dtendFull.params);
    if (!start || isNaN(start.getTime())) continue;
    const cutoff = allDay ? new Date(now.getFullYear(), now.getMonth(), now.getDate()) : now;
    if (start < cutoff && (!end || end < cutoff)) continue;
    events.push({ summary: summary || 'Untitled', start: start.toISOString(), end: end ? end.toISOString() : null, location: location || null, allDay });
  }
  events.sort((a, b) => new Date(a.start) - new Date(b.start));
  return events.slice(0, maxEvents);
}

module.exports = {
  sendResponse,
  sendJson,
  sendError,
  parseIcal,
};
