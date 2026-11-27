# Contributing to LobsterBoard

Thanks for your interest in contributing! This guide covers everything you need to create and submit a community widget.

## Getting Started

1. **Fork** the repo on GitHub and clone locally:
   ```bash
   git clone https://github.com/YOUR_USERNAME/LobsterBoard.git
   cd LobsterBoard
   npm install
   ```

2. **Run the dev server:**
   ```bash
   node server.cjs
   ```
   Open http://localhost:8080 — press **Ctrl+E** to enter edit mode.

3. **Explore the widget format:** Open `js/widgets.js` to see how all 50+ built-in widgets are defined. Each widget is an object in the `WIDGETS` map with a consistent structure.

---

## Widget Development Guide

### Step 1: Copy the Template

```bash
cp -r community-widgets/_template community-widgets/my-widget-name
```

### Step 2: Understand the Widget Object

Every widget is a plain JavaScript object with these fields:

```js
{
  name: 'My Widget',            // Display name in the widget picker
  icon: '🎯',                   // Emoji icon
  category: 'small',            // 'small' | 'large' | 'bar'
  description: 'What it does.', // Shown in the picker tooltip
  defaultWidth: 200,            // Default width in pixels
  defaultHeight: 120,           // Default height in pixels
  hasApiKey: false,              // true if an API key is needed
  properties: { ... },          // User-configurable settings
  preview: `<div>...</div>`,    // Static HTML for the picker thumbnail
  generateHtml: (props) => `...`, // Returns the widget's HTML
  generateJs: (props) => `...`,   // Returns the widget's runtime JS
}
```

### Categories

| Category | Use For | Typical Size |
|----------|---------|-------------|
| `small` | KPI cards, single values, gauges | 180–250 × 100–150 |
| `large` | Lists, logs, tables, multi-row content | 300–500 × 200–400 |
| `bar` | Full-width status bars, tickers | 800+ × 60–100 |

### Properties

Properties appear as editable fields in the right-hand panel. Types are inferred from the default value:

```js
properties: {
  title: 'My Widget',       // string → text input
  count: 10,                // number → number input
  refreshInterval: 60,      // seconds between auto-refreshes
  apiKey: 'YOUR_API_KEY_HERE',
}
```

### `generateHtml(props)`

Returns an HTML string. This is the widget's visual structure.

**Rules:**
- Prefix ALL element IDs with `props.id` — users can add multiple instances of the same widget, so IDs must be unique.
- Use the built-in CSS classes: `dash-card`, `dash-card-head`, `dash-card-title`, `dash-card-body`, `kpi-value`, `kpi-label`.
- Use CSS variables for theming (see [Theme Variables](#theme-variables) below).

```js
generateHtml: (props) => `
  <div class="dash-card" id="widget-${props.id}" style="height:100%;">
    <div class="dash-card-head">
      <span class="dash-card-title">🎯 ${props.title || 'My Widget'}</span>
    </div>
    <div class="dash-card-body" style="display:flex;align-items:center;justify-content:center;">
      <div class="kpi-value blue" id="${props.id}-value">—</div>
    </div>
  </div>`
```

### `generateJs(props)`

Returns a JavaScript string that runs in the browser via `new Function()`. This is where you fetch data, update the DOM, and set up refresh intervals.

**Rules:**
- Use unique function names: `update_${props.id.replace(/-/g, '_')}()`
- Reference elements by the IDs from `generateHtml`
- Handle errors gracefully — show `"—"` or `"Error"`, never let it crash
- Set up auto-refresh with `setInterval`

```js
generateJs: (props) => `
  async function update_${props.id.replace(/-/g, '_')}() {
    const el = document.getElementById('${props.id}-value');
    try {
      const res = await fetch('https://api.example.com/data?key=${props.apiKey}');
      if (!res.ok) throw new Error('HTTP ' + res.status);
      const data = await res.json();
      el.textContent = data.value;
    } catch (e) {
      console.error('Widget error:', e);
      if (el) el.textContent = '—';
    }
  }
  update_${props.id.replace(/-/g, '_')}();
  setInterval(update_${props.id.replace(/-/g, '_')}, ${(props.refreshInterval || 60) * 1000});
`
```

### Refresh Intervals

The `refreshInterval` property (in seconds) controls how often the widget re-fetches data. Convert to milliseconds when calling `setInterval`:

```js
setInterval(myFunction, ${(props.refreshInterval || 60) * 1000});
```

Reasonable defaults: weather → 600s, stocks → 30s, system stats → 5s.

### Theme Variables

LobsterBoard uses a dark theme. Use these CSS variables so your widget fits in:

| Variable | Usage |
|----------|-------|
| `--bg-primary` | Main background |
| `--bg-secondary` | Card/panel background |
| `--bg-tertiary` | Hover/active states |
| `--text-primary` | Primary text color |
| `--text-secondary` | Muted/label text |
| `--border-color` | Borders and dividers |
| `--accent-blue` | Primary accent |
| `--accent-green` | Success/positive |
| `--accent-red` | Error/negative |
| `--accent-yellow` | Warning |
| `--accent-purple` | Purple accent |

---

## Best Practices

1. **Always use `props.id` prefix** for element IDs — multiple instances must coexist.
2. **Escape user content** to prevent XSS. Never use `innerHTML` with raw user strings.
3. **Handle fetch failures gracefully** — show `"—"` or an error state, don't leave "Loading..." forever.
4. **Keep widgets self-contained** — no external CSS frameworks, no heavy libraries.
5. **Use CSS variables** from the theme so your widget matches the dark theme.
6. **Test with multiple instances** of the same widget on the canvas.
7. **Keep it lightweight** — no large dependencies or bundled libraries.
8. **Support the dark theme** — it's the only theme. Don't hardcode white backgrounds.

---

## Security Rules

These are strictly enforced during review:

- ❌ **NEVER** include real API keys, tokens, or private URLs
- ✅ Use `YOUR_API_KEY_HERE` as the placeholder value
- ❌ **NEVER** fetch from private/local IPs (`10.x`, `192.168.x`, `localhost`, `127.0.0.1`)
- ❌ **No** `eval()`, `new Function()` on user input, or dynamic script injection
- ✅ Sanitize any user-provided content before inserting into the DOM
- ✅ Use `textContent` instead of `innerHTML` when displaying user data

---

## Submission Process

1. **Copy the template:**
   ```bash
   cp -r community-widgets/_template community-widgets/your-widget-name
   ```

2. **Build your widget** — edit `widget.js` with your widget object.

3. **Add documentation** — update the `README.md` with a screenshot, description, and property table.

4. **Test locally** — add your widget to `js/widgets.js` temporarily, run the server, and verify:
   - Widget renders correctly
   - Data fetches work (or gracefully fail)
   - Multiple instances work side-by-side
   - No console errors

5. **Submit a PR** with the title format: `[Widget] Widget Name`

6. **Maintainer review** — we check for security, code quality, and functionality.

7. **Merge** — once approved, your widget gets included in the next release! 🎉

### PR Checklist

Your PR will be reviewed against this checklist:

- [ ] No hardcoded API keys, tokens, or private URLs
- [ ] Tested locally with `node server.cjs`
- [ ] README.md included with description and property table
- [ ] Preview image/screenshot included
- [ ] Follows naming conventions (`community-widgets/kebab-case-name/`)
- [ ] Works with multiple instances on the same canvas
- [ ] Uses `props.id` prefix for all element IDs
- [ ] Handles errors gracefully (no unhandled exceptions)
- [ ] No external CSS frameworks or heavy dependencies
- [ ] Uses theme CSS variables (not hardcoded colors)

---

## Questions?

Open an issue on GitHub or start a discussion. We're happy to help!
