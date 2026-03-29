const fs = require('fs');
const { sendJson, sendError } = require('../response.cjs');
const { CONFIG_FILE } = require('../config.cjs');
const { getSecrets } = require('../secrets.cjs');
const aiProviders = require('../ai-providers.cjs');

const {
  fetchWithCache,
  fetchClaudeUsage, fetchCodexUsage, fetchCopilotUsage, fetchCursorUsage,
  fetchGeminiUsage, fetchAmpUsage, fetchFactoryUsage, fetchKimiUsage,
  fetchJetbrainsUsage, fetchMinimaxUsage, fetchZaiUsage, fetchAntigravityUsage,
  getAllAiUsage,
} = aiProviders;

async function handle(req, res, pathname) {
  if (req.method === 'GET' && pathname === '/api/ai-usage') {
    try {
      const data = await getAllAiUsage();
      sendJson(res, 200, { status: 'ok', ...data });
    } catch (e) {
      sendError(res, e.message);
    }
    return true;
  }

  const aiUsageMatch = pathname.match(/^\/api\/ai-usage\/(\w+)$/);
  if (req.method === 'GET' && aiUsageMatch) {
    const provider = aiUsageMatch[1];
    try {
      let data;
      switch (provider) {
        case 'claude':
          data = await fetchWithCache('claude', fetchClaudeUsage);
          break;
        case 'codex':
          data = await fetchWithCache('codex', fetchCodexUsage);
          break;
        case 'copilot':
          data = await fetchWithCache('copilot', fetchCopilotUsage);
          break;
        case 'cursor':
          data = await fetchWithCache('cursor', fetchCursorUsage);
          break;
        case 'gemini':
          data = await fetchWithCache('gemini', fetchGeminiUsage);
          break;
        case 'amp':
          data = await fetchWithCache('amp', fetchAmpUsage);
          break;
        case 'factory':
          data = await fetchWithCache('factory', fetchFactoryUsage);
          break;
        case 'kimi':
          data = await fetchWithCache('kimi', fetchKimiUsage);
          break;
        case 'jetbrains':
          data = await fetchWithCache('jetbrains', fetchJetbrainsUsage);
          break;
        case 'minimax':
          data = await fetchWithCache('minimax', fetchMinimaxUsage);
          break;
        case 'zai':
          data = await fetchWithCache('zai', fetchZaiUsage);
          break;
        case 'antigravity':
          data = await fetchWithCache('antigravity', fetchAntigravityUsage);
          break;
        default:
          sendJson(res, 404, { status: 'error', message: `Unknown provider: ${provider}` });
          return true;
      }
      sendJson(res, 200, { status: 'ok', ...data });
    } catch (e) {
      sendError(res, e.message);
    }
    return true;
  }

  if (req.method === 'GET' && pathname === '/api/usage/claude') {
    let apiKey = process.env.ANTHROPIC_ADMIN_KEY;
    if (!apiKey) {
      try {
        const cfg = JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8'));
        const w = (cfg.widgets || []).find(w => w.type === 'ai-usage-claude');
        if (w && w.properties && w.properties.apiKey && w.properties.apiKey !== '__SECRET__') {
          apiKey = w.properties.apiKey;
        } else if (w) {
          const secrets = getSecrets();
          apiKey = secrets[w.id]?.apiKey || null;
        }
      } catch(e) {}
    }
    if (!apiKey) { sendJson(res, 200, { error: 'No API key configured. Add your Anthropic Admin key in the widget properties.', tokens: 0, cost: 0, models: [] }); return true; }
    (async () => {
      try {
        const now = new Date();
        const today = now.toISOString().slice(0, 10);
        const tomorrow = new Date(now.getTime() + 86400000).toISOString().slice(0, 10);
        const dayOfWeek = now.getDay();
        const mondayOffset = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
        const weekStart = new Date(now.getTime() - mondayOffset * 86400000).toISOString().slice(0, 10);
        const monthStart = today.slice(0, 8) + '01';
        const headers = { 'anthropic-version': '2023-06-01', 'x-api-key': apiKey };
        const base = 'https://api.anthropic.com/v1/organizations/usage_report/messages';

        function aggregateBuckets(data) {
          let totalTokens = 0, totalCost = 0;
          const modelMap = {};
          for (const bucket of (data.data || [])) {
            const input = bucket.input_tokens || 0;
            const output = bucket.output_tokens || 0;
            const tokens = input + output;
            const cost = (bucket.input_cost || 0) + (bucket.output_cost || 0);
            totalTokens += tokens;
            totalCost += cost;
            const model = bucket.model || 'unknown';
            if (!modelMap[model]) modelMap[model] = { name: model, tokens: 0, cost: 0 };
            modelMap[model].tokens += tokens;
            modelMap[model].cost += cost;
          }
          return { tokens: totalTokens, cost: totalCost, models: Object.values(modelMap) };
        }

        const [todayResp, weekResp, monthResp] = await Promise.all([
          fetch(`${base}?starting_at=${today}T00:00:00Z&ending_at=${tomorrow}T00:00:00Z&bucket_width=1d&group_by[]=model`, { headers }),
          fetch(`${base}?starting_at=${weekStart}T00:00:00Z&ending_at=${tomorrow}T00:00:00Z&bucket_width=1d&group_by[]=model`, { headers }),
          fetch(`${base}?starting_at=${monthStart}T00:00:00Z&ending_at=${tomorrow}T00:00:00Z&bucket_width=1d&group_by[]=model`, { headers })
        ]);

        const todayData = await todayResp.json();
        if (!todayResp.ok) { sendJson(res, 200, { error: todayData.error?.message || 'API error', tokens: 0, cost: 0, models: [] }); return; }
        const weekData = await weekResp.json();
        const monthData = await monthResp.json();

        const todayAgg = aggregateBuckets(todayData);
        const weekAgg = aggregateBuckets(weekData);
        const monthAgg = aggregateBuckets(monthData);

        sendJson(res, 200, {
          tokens: todayAgg.tokens, cost: todayAgg.cost, models: todayAgg.models,
          week: { tokens: weekAgg.tokens, cost: weekAgg.cost },
          month: { tokens: monthAgg.tokens, cost: monthAgg.cost }
        });
      } catch (e) {
        sendJson(res, 200, { error: e.message, tokens: 0, cost: 0, models: [] });
      }
    })();
    return true;
  }

  if (req.method === 'GET' && pathname === '/api/usage/openai') {
    let apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      try {
        const cfg = JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8'));
        const w = (cfg.widgets || []).find(w => w.type === 'ai-usage-openai');
        if (w && w.properties && w.properties.apiKey && w.properties.apiKey !== '__SECRET__') {
          apiKey = w.properties.apiKey;
        } else if (w) {
          const secrets = getSecrets();
          apiKey = secrets[w.id]?.apiKey || null;
        }
      } catch(e) {}
    }
    if (!apiKey) { sendJson(res, 200, { error: 'No API key configured. Add your OpenAI key in the widget properties.', tokens: 0, cost: 0, models: [] }); return true; }
    (async () => {
      try {
        const now = new Date();
        const todayUnix = Math.floor(new Date(now.toISOString().slice(0, 10) + 'T00:00:00Z').getTime() / 1000);
        const dayOfWeek = now.getDay();
        const mondayOffset = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
        const weekStartUnix = todayUnix - mondayOffset * 86400;
        const monthStartUnix = Math.floor(new Date(now.toISOString().slice(0, 8) + '01T00:00:00Z').getTime() / 1000);
        const headers = { 'Authorization': `Bearer ${apiKey}` };
        const base = 'https://api.openai.com/v1/organization/costs';

        function aggregateOpenAI(data) {
          let totalCost = 0;
          const modelMap = {};
          for (const bucket of (data.data || [])) {
            for (const lineItem of (bucket.results || [])) {
              const cost = (lineItem.amount?.value || 0);
              totalCost += cost;
              const model = lineItem.line_item || 'unknown';
              if (!modelMap[model]) modelMap[model] = { name: model, tokens: 0, cost: 0 };
              modelMap[model].cost += cost;
            }
          }
          return { cost: totalCost / 100, models: Object.values(modelMap).map(m => ({ ...m, cost: m.cost / 100 })) };
        }

        const [todayResp, weekResp, monthResp] = await Promise.all([
          fetch(`${base}?start_time=${todayUnix}&bucket_width=1d`, { headers }),
          fetch(`${base}?start_time=${weekStartUnix}&bucket_width=1d`, { headers }),
          fetch(`${base}?start_time=${monthStartUnix}&bucket_width=1d`, { headers })
        ]);

        const todayData = await todayResp.json();
        if (!todayResp.ok) {
          const errMsg = todayData.error?.message || todayData.error || 'API error';
          const hint = typeof errMsg === 'string' && errMsg.includes('scope') ? ' Enable "Usage: Read" scope on your API key.' : '';
          sendJson(res, 200, { error: errMsg + hint, tokens: 0, cost: 0, models: [] }); return;
        }
        const weekData = await weekResp.json();
        const monthData = await monthResp.json();

        const todayAgg = aggregateOpenAI(todayData);
        const weekAgg = aggregateOpenAI(weekData);
        const monthAgg = aggregateOpenAI(monthData);

        sendJson(res, 200, {
          tokens: 0, cost: todayAgg.cost, models: todayAgg.models,
          week: { tokens: 0, cost: weekAgg.cost },
          month: { tokens: 0, cost: monthAgg.cost }
        });
      } catch (e) {
        sendJson(res, 200, { error: e.message, tokens: 0, cost: 0, models: [] });
      }
    })();
    return true;
  }

  return false;
}

module.exports = function() {
  return { handle };
};
