/**
 * OpenClaw Dashboard Builder - Weather Widgets
 */
(function(WIDGETS) {

  WIDGETS['weather'] = {
    name: 'Local Weather',
    icon: '🌡️',
    category: 'small',
    description: 'Shows current weather for a single location using Open-Meteo (no API key needed).',
    defaultWidth: 200,
    defaultHeight: 120,
    hasApiKey: false,
    properties: {
      title: 'Local Weather',
      location: 'Atlanta',
      units: 'F',
      refreshInterval: 600
    },
    preview: `<div style="text-align:center;padding:8px;">
      <div style="font-size:24px;">72°F</div>
      <div style="font-size:11px;color:#8b949e;">Atlanta</div>
    </div>`,
    generateHtml: (props) => `
      <div class="dash-card" id="widget-${props.id}" style="height:100%;">
        <div class="dash-card-head">
          <span class="dash-card-title">${renderIcon('weather')} ${props.title || 'Local Weather'}</span>
        </div>
        <div class="dash-card-body" style="display:flex;align-items:center;justify-content:center;gap:10px;">
          <span id="${props.id}-icon" class="lb-icon lb-icon-lg" data-icon="weather">🌡️</span>
          <div>
            <div class="kpi-value blue" id="${props.id}-value">Loading...</div>
            <div class="kpi-label" id="${props.id}-label">${props.location || 'Location'}</div>
          </div>
        </div>
      </div>`,
    generateJs: (props) => `
      // Weather Widget: ${props.id} (uses free Open-Meteo API - no key needed)
      const WMO_DESC = {0:'Clear sky',1:'Mainly clear',2:'Partly cloudy',3:'Overcast',45:'Fog',48:'Rime fog',51:'Light drizzle',53:'Drizzle',55:'Dense drizzle',61:'Slight rain',63:'Moderate rain',65:'Heavy rain',71:'Slight snow',73:'Moderate snow',75:'Heavy snow',80:'Slight showers',81:'Moderate showers',82:'Violent showers',95:'Thunderstorm',96:'Hail thunderstorm',99:'Heavy hail'};
      function wmoIcon(code) {
        if (code <= 1) return 'weather-sunny';
        if (code <= 3) return 'weather-cloudy';
        if (code >= 51 && code <= 82) return 'weather-rainy';
        if (code >= 71 && code <= 77) return 'weather-snowy';
        if (code >= 95) return 'weather-rainy';
        return 'weather';
      }
      async function update_${props.id.replace(/-/g, '_')}() {
        const valEl = document.getElementById('${props.id}-value');
        const labelEl = document.getElementById('${props.id}-label');
        const iconEl = document.getElementById('${props.id}-icon');
        try {
          const loc = '${props.location || 'Atlanta'}';
          const geoRes = await fetch('https://geocoding-api.open-meteo.com/v1/search?name=' + encodeURIComponent(loc) + '&count=1');
          const geoData = await geoRes.json();
          if (!geoData.results || !geoData.results.length) throw new Error('City not found');
          const {latitude, longitude} = geoData.results[0];
          const tempUnit = '${props.units}' === 'C' ? 'celsius' : 'fahrenheit';
          const res = await fetch('https://api.open-meteo.com/v1/forecast?latitude=' + latitude + '&longitude=' + longitude + '&current=temperature_2m,weathercode,windspeed_10m&temperature_unit=' + tempUnit);
          const data = await res.json();
          const c = data.current;
          const unit = '${props.units}' === 'C' ? '°C' : '°F';
          valEl.textContent = Math.round(c.temperature_2m) + unit;
          labelEl.textContent = WMO_DESC[c.weathercode] || 'Unknown';
          const iconId = wmoIcon(c.weathercode);
          iconEl.setAttribute('data-icon', iconId);
          const icons = window.WIDGET_ICONS || {};
          iconEl.textContent = icons[iconId] ? icons[iconId].emoji : '🌡️';
        } catch (e) {
          console.error('Weather widget error:', e);
          if (!valEl.dataset.loaded) valEl.textContent = 'Unavailable';
        }
        valEl.dataset.loaded = '1';
      }
      update_${props.id.replace(/-/g, '_')}();
      setInterval(update_${props.id.replace(/-/g, '_')}, ${(props.refreshInterval || 600) * 1000});
    `
  };

  WIDGETS['weather-multi'] = {
    name: 'World Weather',
    icon: '🌍',
    category: 'large',
    description: 'Shows weather for multiple locations side-by-side. Separate cities with semicolons.',
    defaultWidth: 350,
    defaultHeight: 200,
    hasApiKey: false,
    properties: {
      title: 'World Weather',
      locations: 'New York; London; Tokyo',
      units: 'F',
      refreshInterval: 600
    },
    preview: `<div style="padding:4px;font-size:11px;">
      <div>🌡️ New York: 72°F</div>
      <div>🌡️ London: 58°F</div>
      <div>🌡️ Tokyo: 68°F</div>
    </div>`,
    generateHtml: (props) => `
      <div class="dash-card" id="widget-${props.id}" style="height:100%;">
        <div class="dash-card-head">
          <span class="dash-card-title">${renderIcon('world-weather')} ${props.title || 'World Weather'}</span>
        </div>
        <div class="dash-card-body" id="${props.id}-list">
          <div class="weather-row"><span class="weather-icon lb-icon" data-icon="weather-sunny">☀️</span><span class="weather-loc">New York</span><span class="weather-temp">72°F</span></div>
          <div class="weather-row"><span class="weather-icon lb-icon" data-icon="weather-cloudy">⛅</span><span class="weather-loc">London</span><span class="weather-temp">58°F</span></div>
          <div class="weather-row"><span class="weather-icon lb-icon" data-icon="weather-rainy">🌧️</span><span class="weather-loc">Tokyo</span><span class="weather-temp">65°F</span></div>
        </div>
      </div>`,
    generateJs: (props) => `
      // Multi Weather Widget: ${props.id} (uses free Open-Meteo API - no key needed)
      const WMO_DESC2 = {0:'Clear',1:'Clear',2:'Partly cloudy',3:'Overcast',45:'Fog',48:'Rime fog',51:'Drizzle',53:'Drizzle',55:'Drizzle',61:'Rain',63:'Rain',65:'Heavy rain',71:'Snow',73:'Snow',75:'Heavy snow',80:'Showers',81:'Showers',82:'Showers',95:'Storm',96:'Hail',99:'Hail'};
      function wmoIcon2(code) {
        if (code <= 1) return 'weather-sunny';
        if (code <= 3) return 'weather-cloudy';
        if (code >= 51 && code <= 82) return 'weather-rainy';
        if (code >= 71 && code <= 77) return 'weather-snowy';
        if (code >= 95) return 'weather-rainy';
        return 'weather';
      }
      async function update_${props.id.replace(/-/g, '_')}() {
        const locations = '${props.locations || 'New York; London; Tokyo'}'.split(';').map(l => l.trim());
        const container = document.getElementById('${props.id}-list');
        const tempUnit = '${props.units}' === 'C' ? 'celsius' : 'fahrenheit';
        const unitSymbol = '${props.units}' === 'C' ? '°C' : '°F';
        
        const results = await Promise.all(locations.map(async (loc) => {
          try {
            const geoRes = await fetch('https://geocoding-api.open-meteo.com/v1/search?name=' + encodeURIComponent(loc) + '&count=1');
            const geoData = await geoRes.json();
            if (!geoData.results || !geoData.results.length) return { loc, temp: 'N/A', iconId: 'weather', emoji: '❓' };
            const {latitude, longitude} = geoData.results[0];
            const res = await fetch('https://api.open-meteo.com/v1/forecast?latitude=' + latitude + '&longitude=' + longitude + '&current=temperature_2m,weathercode&temperature_unit=' + tempUnit);
            const data = await res.json();
            const c = data.current;
            const iconId = wmoIcon2(c.weathercode);
            const icons = window.WIDGET_ICONS || {};
            const emoji = icons[iconId] ? icons[iconId].emoji : '🌡️';
            return { loc, temp: Math.round(c.temperature_2m), iconId, emoji };
          } catch (e) {
            return { loc, temp: 'N/A', iconId: 'weather', emoji: '❓' };
          }
        }));
        
        container.innerHTML = results.map(r =>
          '<div class="weather-row"><span class="weather-icon lb-icon" data-icon="' + _esc(r.iconId) + '">' + _esc(r.emoji) + '</span><span class="weather-loc">' + _esc(r.loc) + '</span><span class="weather-temp">' + _esc(String(r.temp)) + _esc(unitSymbol) + '</span></div>'
        ).join('');
      }
      update_${props.id.replace(/-/g, '_')}();
      setInterval(update_${props.id.replace(/-/g, '_')}, ${(props.refreshInterval || 600) * 1000});
    `
  };

})(typeof window !== 'undefined' ? (window.WIDGETS = window.WIDGETS || {}) : {});
