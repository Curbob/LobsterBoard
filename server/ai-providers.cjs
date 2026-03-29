const fs = require('fs');
const path = require('path');
const os = require('os');
const config = require('./config.cjs');

const { CWD } = config;

const AI_PROVIDERS = {
  claude: {
    name: 'Claude Code',
    icon: '🟣',
    credPaths: [
      path.join(os.homedir(), '.claude', '.credentials.json'),
    ],
    keychainService: 'Claude Code-credentials',
  },
  codex: {
    name: 'Codex CLI',
    icon: '🟢',
    credPaths: [
      process.env.CODEX_HOME ? path.join(process.env.CODEX_HOME, 'auth.json') : null,
      path.join(os.homedir(), '.config', 'codex', 'auth.json'),
      path.join(os.homedir(), '.codex', 'auth.json'),
    ].filter(Boolean),
    keychainService: 'Codex Auth',
  },
  copilot: {
    name: 'GitHub Copilot',
    icon: '⚫',
    keychainService: 'gh:github.com',
  },
  cursor: {
    name: 'Cursor',
    icon: '🔵',
    sqlitePath: path.join(os.homedir(), 'Library', 'Application Support', 'Cursor', 'User', 'globalStorage', 'state.vscdb'),
  },
  gemini: {
    name: 'Gemini',
    icon: '🔷',
    credPaths: [
      path.join(os.homedir(), '.gemini', 'oauth_creds.json'),
    ],
    settingsPath: path.join(os.homedir(), '.gemini', 'settings.json'),
  },
  amp: {
    name: 'Amp',
    icon: '⚡',
    credPaths: [
      path.join(os.homedir(), '.local', 'share', 'amp', 'secrets.json'),
    ],
  },
  factory: {
    name: 'Factory',
    icon: '🏭',
    credPaths: [
      path.join(os.homedir(), '.factory', 'auth.json'),
    ],
  },
  kimi: {
    name: 'Kimi Code',
    icon: '🌙',
    credPaths: [
      path.join(os.homedir(), '.kimi', 'credentials', 'kimi-code.json'),
    ],
  },
  jetbrains: {
    name: 'JetBrains AI',
    icon: '🧠',
    configDirs: [
      path.join(os.homedir(), 'Library', 'Application Support', 'JetBrains'),
    ],
  },
  minimax: {
    name: 'MiniMax',
    icon: '🔶',
    envKeys: ['MINIMAX_API_KEY', 'MINIMAX_CN_API_KEY', 'MINIMAX_API_TOKEN'],
  },
  zai: {
    name: 'Z.ai',
    icon: '🇿',
    envKeys: ['ZAI_API_KEY', 'GLM_API_KEY'],
  },
  antigravity: {
    name: 'Antigravity',
    icon: '🪐',
    configPath: path.join(os.homedir(), 'Library', 'Application Support', 'antigravity-usage', 'config.json'),
    accountsDir: path.join(os.homedir(), 'Library', 'Application Support', 'antigravity-usage', 'accounts'),
    tokenUrl: 'https://oauth2.googleapis.com/token',
    apiUrl: 'https://cloudcode-pa.googleapis.com/v1internal:fetchAvailableModels',
  },
};

function readCredentials(provider) {
  const providerConfig = AI_PROVIDERS[provider];
  if (!providerConfig) return null;

  for (const credPath of providerConfig.credPaths) {
    try {
      if (fs.existsSync(credPath)) {
        const content = fs.readFileSync(credPath, 'utf8');
        return { source: 'file', path: credPath, data: JSON.parse(content) };
      }
    } catch (e) {
    }
  }

  if (process.platform === 'darwin' && providerConfig.keychainService) {
    const { execSync } = require('child_process');
    const accounts = [process.env.USER, os.userInfo().username, 'Claude Code', ''].filter(Boolean);

    for (const account of accounts) {
      try {
        const accountArg = account ? `-a "${account}"` : '';
        const keychainData = execSync(
          `security find-generic-password -s "${providerConfig.keychainService}" ${accountArg} -w 2>/dev/null`,
          { encoding: 'utf8', timeout: 5000 }
        ).trim();
        if (keychainData) {
          const parsed = JSON.parse(keychainData);
          const oauth = parsed.claudeAiOauth || parsed;
          if (oauth.expiresAt && oauth.expiresAt > Date.now()) {
            return { source: 'keychain', service: providerConfig.keychainService, account, data: parsed };
          }
          if (!providerConfig._fallbackCreds) {
            providerConfig._fallbackCreds = { source: 'keychain', service: providerConfig.keychainService, account, data: parsed };
          }
        }
      } catch (e) {
      }
    }
    if (providerConfig._fallbackCreds) {
      const result = providerConfig._fallbackCreds;
      delete providerConfig._fallbackCreds;
      return result;
    }
  }

  return null;
}

async function refreshClaudeToken(refreshToken, credPath) {
  try {
    const resp = await fetch('https://platform.claude.com/v1/oauth/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        grant_type: 'refresh_token',
        refresh_token: refreshToken,
        client_id: '9d1c250a-e61b-44d9-88ed-5944d1962f5e',
        scope: 'user:profile user:inference user:sessions:claude_code user:mcp_servers',
      }),
    });

    if (!resp.ok) return { error: 'Refresh failed (HTTP ' + resp.status + ')' };

    const data = await resp.json();

    if (credPath && fs.existsSync(credPath)) {
      try {
        const existing = JSON.parse(fs.readFileSync(credPath, 'utf8'));
        existing.claudeAiOauth.accessToken = data.access_token;
        if (data.refresh_token) existing.claudeAiOauth.refreshToken = data.refresh_token;
        existing.claudeAiOauth.expiresAt = Date.now() + (data.expires_in * 1000);
        fs.writeFileSync(credPath, JSON.stringify(existing, null, 2));
      } catch (e) {
      }
    }

    return { accessToken: data.access_token };
  } catch (e) {
    return { error: e.message };
  }
}

async function fetchClaudeUsage() {
  const baseInfo = {
    provider: 'claude',
    name: AI_PROVIDERS.claude.name,
    icon: AI_PROVIDERS.claude.icon,
  };

  const creds = readCredentials('claude');
  if (!creds) return { ...baseInfo, error: 'Not logged in. Run `claude` to authenticate.' };

  const oauthData = creds.data.claudeAiOauth;
  if (!oauthData?.accessToken) return { ...baseInfo, error: 'No access token found.' };

  let accessToken = oauthData.accessToken;

  async function makeRequest(token) {
    const resp = await fetch('https://api.anthropic.com/api/oauth/usage', {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        'anthropic-beta': 'oauth-2025-04-20',
        'User-Agent': 'claude-code/1.0.0',
        'X-Client-Name': 'claude-code',
      },
    });
    return resp;
  }

  let resp = await makeRequest(accessToken);

  if (resp.status === 401 || resp.status === 403) {
    if (!oauthData.refreshToken) {
      return { ...baseInfo, error: 'Session expired. Run `claude` to re-authenticate.' };
    }
    try {
      const refreshed = await refreshClaudeToken(oauthData.refreshToken, creds.source === 'file' ? creds.path : null);
      if (refreshed.error) {
        return { ...baseInfo, error: 'Session expired. Run `claude` to re-authenticate.' };
      }
      accessToken = refreshed.accessToken;
      resp = await makeRequest(accessToken);
    } catch (e) {
      return { ...baseInfo, error: 'Session expired. Run `claude` to re-authenticate.' };
    }
  }

  try {
    if (!resp.ok) {
      if (resp.status === 429) {
        return { ...baseInfo, error: '429 rate limited - using cache' };
      }
      return { ...baseInfo, error: `API error (HTTP ${resp.status})` };
    }

    const data = await resp.json();

    const metrics = [];

    if (data.five_hour) {
      metrics.push({
        label: 'Session (5h)',
        used: data.five_hour.utilization,
        limit: 100,
        format: 'percent',
        resetsAt: data.five_hour.resets_at,
      });
    }

    if (data.seven_day) {
      metrics.push({
        label: 'Weekly',
        used: data.seven_day.utilization,
        limit: 100,
        format: 'percent',
        resetsAt: data.seven_day.resets_at,
      });
    }

    if (data.seven_day_opus) {
      metrics.push({
        label: 'Opus Weekly',
        used: data.seven_day_opus.utilization,
        limit: 100,
        format: 'percent',
        resetsAt: data.seven_day_opus.resets_at,
      });
    }

    if (data.extra_usage?.is_enabled) {
      metrics.push({
        label: 'Extra Credits',
        used: data.extra_usage.used_credits / 100,
        limit: data.extra_usage.monthly_limit ? data.extra_usage.monthly_limit / 100 : null,
        format: 'dollars',
      });
    }

    return {
      provider: 'claude',
      name: AI_PROVIDERS.claude.name,
      icon: AI_PROVIDERS.claude.icon,
      plan: oauthData.subscriptionType || 'unknown',
      metrics,
    };
  } catch (e) {
    return { ...baseInfo, error: 'Network error: ' + e.message };
  }
}

async function fetchCodexUsage() {
  const baseInfo = {
    provider: 'codex',
    name: AI_PROVIDERS.codex.name,
    icon: AI_PROVIDERS.codex.icon,
  };

  const creds = readCredentials('codex');
  if (!creds) return { ...baseInfo, error: 'Not logged in. Run `codex auth` to authenticate.' };

  const tokens = creds.data.tokens;
  if (!tokens?.access_token) return { ...baseInfo, error: 'No access token found.' };

  try {
    const headers = {
      'Authorization': `Bearer ${tokens.access_token}`,
      'Accept': 'application/json',
    };
    if (tokens.account_id) {
      headers['ChatGPT-Account-Id'] = tokens.account_id;
    }

    const resp = await fetch('https://chatgpt.com/backend-api/wham/usage', { headers });

    if (!resp.ok) {
      if (resp.status === 401 || resp.status === 403) {
        return { ...baseInfo, error: 'Session expired. Run `codex auth` to re-authenticate.' };
      }
      return { ...baseInfo, error: `API error (HTTP ${resp.status})` };
    }

    const data = await resp.json();

    const metrics = [];

    if (data.rate_limit?.primary_window) {
      const pw = data.rate_limit.primary_window;
      metrics.push({
        label: 'Session (5h)',
        used: pw.used_percent,
        limit: 100,
        format: 'percent',
        resetsAt: pw.reset_at ? new Date(pw.reset_at * 1000).toISOString() : null,
      });
    }

    if (data.rate_limit?.secondary_window) {
      const sw = data.rate_limit.secondary_window;
      metrics.push({
        label: 'Weekly',
        used: sw.used_percent,
        limit: 100,
        format: 'percent',
        resetsAt: sw.reset_at ? new Date(sw.reset_at * 1000).toISOString() : null,
      });
    }

    if (data.code_review_rate_limit?.primary_window) {
      const cr = data.code_review_rate_limit.primary_window;
      metrics.push({
        label: 'Code Reviews',
        used: cr.used_percent,
        limit: 100,
        format: 'percent',
        resetsAt: cr.reset_at ? new Date(cr.reset_at * 1000).toISOString() : null,
      });
    }

    if (data.credits?.has_credits) {
      metrics.push({
        label: 'Credits',
        used: null,
        remaining: data.credits.balance,
        format: 'dollars',
        unlimited: data.credits.unlimited,
      });
    }

    return {
      provider: 'codex',
      name: AI_PROVIDERS.codex.name,
      icon: AI_PROVIDERS.codex.icon,
      plan: data.plan_type || 'unknown',
      metrics,
    };
  } catch (e) {
    return { ...baseInfo, error: 'Network error: ' + e.message };
  }
}

async function fetchCopilotUsage() {
  const baseInfo = {
    provider: 'copilot',
    name: AI_PROVIDERS.copilot.name,
    icon: AI_PROVIDERS.copilot.icon,
  };

  let token = null;
  if (process.platform === 'darwin') {
    try {
      const { execSync } = require('child_process');
      token = execSync('security find-generic-password -s "gh:github.com" -w 2>/dev/null',
        { encoding: 'utf8', timeout: 5000 }).trim();
    } catch (e) {}
  }

  if (!token) {
    return { ...baseInfo, error: 'Not logged in. Run `gh auth login` first.' };
  }

  try {
    const resp = await fetch('https://api.github.com/copilot_internal/user', {
      headers: {
        'Authorization': `token ${token}`,
        'Accept': 'application/json',
        'Editor-Version': 'vscode/1.96.2',
        'Editor-Plugin-Version': 'copilot-chat/0.26.7',
        'User-Agent': 'GitHubCopilotChat/0.26.7',
        'X-Github-Api-Version': '2025-04-01',
      },
    });

    if (!resp.ok) {
      if (resp.status === 401 || resp.status === 403) {
        return { ...baseInfo, error: 'Token invalid. Run `gh auth login` to re-auth.' };
      }
      return { ...baseInfo, error: `API error (HTTP ${resp.status})` };
    }

    const data = await resp.json();
    const metrics = [];

    if (data.quota_snapshots) {
      if (data.quota_snapshots.premium_interactions) {
        const p = data.quota_snapshots.premium_interactions;
        metrics.push({
          label: 'Premium',
          used: 100 - p.percent_remaining,
          limit: 100,
          format: 'percent',
          resetsAt: data.quota_reset_date,
        });
      }
      if (data.quota_snapshots.chat) {
        const c = data.quota_snapshots.chat;
        metrics.push({
          label: 'Chat',
          used: 100 - c.percent_remaining,
          limit: 100,
          format: 'percent',
          resetsAt: data.quota_reset_date,
        });
      }
    }

    if (data.limited_user_quotas && data.monthly_quotas) {
      const chatUsed = data.monthly_quotas.chat - data.limited_user_quotas.chat;
      const compUsed = data.monthly_quotas.completions - data.limited_user_quotas.completions;
      metrics.push({
        label: 'Chat',
        used: (chatUsed / data.monthly_quotas.chat) * 100,
        limit: 100,
        format: 'percent',
        resetsAt: data.limited_user_reset_date,
      });
      metrics.push({
        label: 'Completions',
        used: (compUsed / data.monthly_quotas.completions) * 100,
        limit: 100,
        format: 'percent',
        resetsAt: data.limited_user_reset_date,
      });
    }

    return {
      ...baseInfo,
      plan: data.copilot_plan || 'unknown',
      metrics,
    };
  } catch (e) {
    return { ...baseInfo, error: 'Network error: ' + e.message };
  }
}

async function fetchCursorUsage() {
  const baseInfo = {
    provider: 'cursor',
    name: AI_PROVIDERS.cursor.name,
    icon: AI_PROVIDERS.cursor.icon,
  };

  const dbPath = AI_PROVIDERS.cursor.sqlitePath;
  if (!fs.existsSync(dbPath)) {
    return { ...baseInfo, error: 'Cursor not installed.' };
  }

  let accessToken = null;
  let membershipType = null;
  try {
    const { execSync } = require('child_process');
    accessToken = execSync(`sqlite3 "${dbPath}" "SELECT value FROM ItemTable WHERE key = 'cursorAuth/accessToken'" 2>/dev/null`,
      { encoding: 'utf8', timeout: 5000 }).trim();
    membershipType = execSync(`sqlite3 "${dbPath}" "SELECT value FROM ItemTable WHERE key = 'cursorAuth/stripeMembershipType'" 2>/dev/null`,
      { encoding: 'utf8', timeout: 5000 }).trim();
  } catch (e) {}

  if (!accessToken) {
    return { ...baseInfo, error: 'Not logged in. Sign in to Cursor.' };
  }

  try {
    const resp = await fetch('https://api2.cursor.sh/aiserver.v1.DashboardService/GetCurrentPeriodUsage', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        'Connect-Protocol-Version': '1',
      },
      body: '{}',
    });

    if (!resp.ok) {
      if (resp.status === 401 || resp.status === 403) {
        return { ...baseInfo, error: 'Session expired. Re-sign in to Cursor.' };
      }
      return { ...baseInfo, error: `API error (HTTP ${resp.status})` };
    }

    const data = await resp.json();
    const metrics = [];

    if (data.planUsage) {
      const pu = data.planUsage;
      if (typeof pu.totalPercentUsed === 'number' && isFinite(pu.totalPercentUsed)) {
        metrics.push({
          label: 'Total Usage',
          used: pu.totalPercentUsed,
          limit: 100,
          format: 'percent',
        });
      }
      if (typeof pu.autoPercentUsed === 'number' && isFinite(pu.autoPercentUsed)) {
        metrics.push({
          label: 'Auto',
          used: pu.autoPercentUsed,
          limit: 100,
          format: 'percent',
        });
      }
      if (typeof pu.apiPercentUsed === 'number' && isFinite(pu.apiPercentUsed)) {
        metrics.push({
          label: 'API',
          used: pu.apiPercentUsed,
          limit: 100,
          format: 'percent',
        });
      }
    }

    return {
      ...baseInfo,
      plan: membershipType || 'unknown',
      metrics,
    };
  } catch (e) {
    return { ...baseInfo, error: 'Network error: ' + e.message };
  }
}

const GEMINI_CLIENT_ID = '681255809395-oo8ft2oprdrnp9e3aqf6av3hmdib135j.apps.googleusercontent.com';
const GEMINI_CLIENT_SECRET = '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';

async function refreshGeminiToken(credsPath, creds) {
  if (!creds.refresh_token) return { error: 'No refresh token available.' };
  try {
    const resp = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: creds.refresh_token,
        client_id: GEMINI_CLIENT_ID,
        client_secret: GEMINI_CLIENT_SECRET,
      }),
    });
    if (!resp.ok) return { error: 'Refresh failed (HTTP ' + resp.status + ')' };
    const data = await resp.json();
    const updated = {
      ...creds,
      access_token: data.access_token,
      expiry_date: Date.now() + (data.expires_in * 1000),
    };
    if (data.refresh_token) updated.refresh_token = data.refresh_token;
    if (data.id_token) updated.id_token = data.id_token;
    try { fs.writeFileSync(credsPath, JSON.stringify(updated, null, 2)); } catch (_) {}
    return { accessToken: data.access_token, creds: updated };
  } catch (e) {
    return { error: e.message };
  }
}

async function fetchGeminiUsage() {
  const baseInfo = {
    provider: 'gemini',
    name: AI_PROVIDERS.gemini.name,
    icon: AI_PROVIDERS.gemini.icon,
  };

  const credsPath = AI_PROVIDERS.gemini.credPaths[0];
  if (!fs.existsSync(credsPath)) {
    return { ...baseInfo, error: 'Not logged in. Run `gemini auth` first.' };
  }

  let creds;
  try {
    creds = JSON.parse(fs.readFileSync(credsPath, 'utf8'));
  } catch (e) {
    return { ...baseInfo, error: 'Invalid credentials file.' };
  }

  if (!creds.access_token && !creds.refresh_token) {
    return { ...baseInfo, error: 'No access token found.' };
  }

  const FIVE_MINUTES = 5 * 60 * 1000;
  if (!creds.access_token || (creds.expiry_date && Date.now() >= creds.expiry_date - FIVE_MINUTES)) {
    const refreshed = await refreshGeminiToken(credsPath, creds);
    if (refreshed.error) return { ...baseInfo, error: 'Session expired. Run `gemini auth` to re-auth.' };
    creds = refreshed.creds;
  }

  const callQuotaApi = (token) => fetch('https://cloudcode-pa.googleapis.com/v1internal:retrieveUserQuota', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: '{}',
  });

  try {
    let resp = await callQuotaApi(creds.access_token);

    if (resp.status === 401 || resp.status === 403) {
      const refreshed = await refreshGeminiToken(credsPath, creds);
      if (refreshed.error) return { ...baseInfo, error: 'Session expired. Run `gemini auth` to re-auth.' };
      creds = refreshed.creds;
      resp = await callQuotaApi(creds.access_token);
    }

    if (!resp.ok) {
      if (resp.status === 401 || resp.status === 403) {
        return { ...baseInfo, error: 'Session expired. Run `gemini auth` to re-auth.' };
      }
      return { ...baseInfo, error: `API error (HTTP ${resp.status})` };
    }

    const data = await resp.json();
    const metrics = [];

    const buckets = data.buckets || data.quotaBuckets || [];

    const seen = new Set();

    for (const bucket of buckets) {
      if (bucket.tokenType !== 'REQUESTS') continue;
      if (bucket.modelId?.includes('_vertex')) continue;
      if (!bucket.modelId?.startsWith('gemini-')) continue;
      if (seen.has(bucket.modelId)) continue;
      seen.add(bucket.modelId);

      const remaining = bucket.remainingFraction ?? 1;
      metrics.push({
        label: bucket.modelId || 'Quota',
        used: Math.round((1 - remaining) * 100),
        limit: 100,
        format: 'percent',
        resetTime: bucket.resetTime,
      });
    }

    metrics.sort((a, b) => String(a.label || '').localeCompare(String(b.label || '')));

    return {
      ...baseInfo,
      plan: 'Gemini CLI',
      metrics,
    };
  } catch (e) {
    return { ...baseInfo, error: 'Network error: ' + e.message };
  }
}

async function fetchAmpUsage() {
  const baseInfo = {
    provider: 'amp',
    name: AI_PROVIDERS.amp.name,
    icon: AI_PROVIDERS.amp.icon,
  };

  const secretsPath = AI_PROVIDERS.amp.credPaths[0];
  if (!fs.existsSync(secretsPath)) {
    return { ...baseInfo, error: 'Amp not installed. Install Amp Code to get started.' };
  }

  let secrets;
  try {
    secrets = JSON.parse(fs.readFileSync(secretsPath, 'utf8'));
  } catch (e) {
    return { ...baseInfo, error: 'Invalid secrets file.' };
  }

  const apiKey = secrets['apiKey@https://ampcode.com/'];
  if (!apiKey) {
    return { ...baseInfo, error: 'Not logged in. Sign in to Amp Code.' };
  }

  try {
    const resp = await fetch('https://ampcode.com/api/internal', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ method: 'userDisplayBalanceInfo', params: {} }),
    });

    if (!resp.ok) {
      if (resp.status === 401 || resp.status === 403) {
        return { ...baseInfo, error: 'Session expired. Re-authenticate in Amp Code.' };
      }
      return { ...baseInfo, error: `API error (HTTP ${resp.status})` };
    }

    const data = await resp.json();
    const metrics = [];

    const displayText = data.result?.displayText || data.displayText || '';

    const freeMatch = displayText.match(/\$(\d+(?:\.\d+)?)\s*\/\s*\$(\d+(?:\.\d+)?)\s+remaining/i);
    if (freeMatch) {
      const remaining = parseFloat(freeMatch[1]);
      const total = parseFloat(freeMatch[2]);
      const used = total - remaining;
      metrics.push({
        label: 'Free',
        used: (used / total) * 100,
        limit: 100,
        format: 'percent',
      });
    }

    const creditsMatch = displayText.match(/Individual credits:\s*\$(\d+(?:\.\d+)?)/i);
    if (creditsMatch) {
      metrics.push({
        label: 'Credits',
        used: null,
        remaining: parseFloat(creditsMatch[1]),
        format: 'dollars',
      });
    }

    return {
      ...baseInfo,
      plan: freeMatch ? 'Free' : (creditsMatch ? 'Credits' : 'unknown'),
      metrics,
    };
  } catch (e) {
    return { ...baseInfo, error: 'Network error: ' + e.message };
  }
}

async function fetchFactoryUsage() {
  const baseInfo = { provider: 'factory', name: AI_PROVIDERS.factory.name, icon: AI_PROVIDERS.factory.icon };
  const authPath = AI_PROVIDERS.factory.credPaths[0];

  if (!fs.existsSync(authPath)) {
    return { ...baseInfo, error: 'Not logged in. Run `droid` to authenticate.' };
  }

  let auth;
  try { auth = JSON.parse(fs.readFileSync(authPath, 'utf8')); }
  catch (e) { return { ...baseInfo, error: 'Invalid auth file.' }; }

  if (!auth.access_token) return { ...baseInfo, error: 'No access token found.' };

  try {
    const resp = await fetch('https://api.factory.ai/api/organization/subscription/usage', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${auth.access_token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ useCache: true }),
    });

    if (!resp.ok) {
      if (resp.status === 401 || resp.status === 403) return { ...baseInfo, error: 'Session expired. Run `droid` to re-auth.' };
      return { ...baseInfo, error: `API error (HTTP ${resp.status})` };
    }

    const data = await resp.json();
    const metrics = [];

    if (data.usage?.standard) {
      const s = data.usage.standard;
      metrics.push({ label: 'Standard', used: (s.usedRatio || 0) * 100, limit: 100, format: 'percent' });
    }
    if (data.usage?.premium?.totalAllowance > 0) {
      const p = data.usage.premium;
      metrics.push({ label: 'Premium', used: (p.usedRatio || 0) * 100, limit: 100, format: 'percent' });
    }

    const allowance = data.usage?.standard?.totalAllowance || 0;
    const plan = allowance >= 200000000 ? 'Max' : allowance >= 20000000 ? 'Pro' : 'Basic';

    return { ...baseInfo, plan, metrics };
  } catch (e) { return { ...baseInfo, error: 'Network error: ' + e.message }; }
}

async function fetchKimiUsage() {
  const baseInfo = { provider: 'kimi', name: AI_PROVIDERS.kimi.name, icon: AI_PROVIDERS.kimi.icon };
  const credPath = AI_PROVIDERS.kimi.credPaths[0];

  if (!fs.existsSync(credPath)) {
    return { ...baseInfo, error: 'Not logged in. Run `kimi login` first.' };
  }

  let creds;
  try { creds = JSON.parse(fs.readFileSync(credPath, 'utf8')); }
  catch (e) { return { ...baseInfo, error: 'Invalid credentials file.' }; }

  if (!creds.access_token) return { ...baseInfo, error: 'No access token found.' };

  try {
    const resp = await fetch('https://api.kimi.com/coding/v1/usages', {
      headers: { 'Authorization': `Bearer ${creds.access_token}`, 'Accept': 'application/json' },
    });

    if (!resp.ok) {
      if (resp.status === 401 || resp.status === 403) return { ...baseInfo, error: 'Session expired. Run `kimi login` to re-auth.' };
      return { ...baseInfo, error: `API error (HTTP ${resp.status})` };
    }

    const data = await resp.json();
    const metrics = [];

    if (data.usage) {
      const used = parseInt(data.usage.limit) - parseInt(data.usage.remaining);
      const total = parseInt(data.usage.limit);
      metrics.push({ label: 'Session', used: (used / total) * 100, limit: 100, format: 'percent', resetsAt: data.usage.resetTime });
    }

    const plan = data.user?.membership?.level?.replace('LEVEL_', '') || 'unknown';
    return { ...baseInfo, plan, metrics };
  } catch (e) { return { ...baseInfo, error: 'Network error: ' + e.message }; }
}

async function fetchJetbrainsUsage() {
  const baseInfo = { provider: 'jetbrains', name: AI_PROVIDERS.jetbrains.name, icon: AI_PROVIDERS.jetbrains.icon };
  const configDir = AI_PROVIDERS.jetbrains.configDirs[0];

  if (!fs.existsSync(configDir)) {
    return { ...baseInfo, error: 'JetBrains IDE not detected.' };
  }

  let quotaData = null;
  try {
    const dirs = fs.readdirSync(configDir).filter(d => !d.startsWith('.'));
    for (const dir of dirs.sort().reverse()) {
      const quotaPath = path.join(configDir, dir, 'options', 'AIAssistantQuotaManager2.xml');
      if (fs.existsSync(quotaPath)) {
        const content = fs.readFileSync(quotaPath, 'utf8');
        const currentMatch = content.match(/<option name="current" value="(\d+)"/);
        const maxMatch = content.match(/<option name="maximum" value="(\d+)"/);
        if (currentMatch && maxMatch) {
          quotaData = { current: parseInt(currentMatch[1]), maximum: parseInt(maxMatch[1]) };
          break;
        }
      }
    }
  } catch (e) { /* ignore */ }

  if (!quotaData) {
    return { ...baseInfo, error: 'JetBrains AI quota not found. Open AI Assistant in IDE.' };
  }

  const used = (quotaData.current / quotaData.maximum) * 100;
  return { ...baseInfo, plan: 'AI Assistant', metrics: [{ label: 'Quota', used, limit: 100, format: 'percent' }] };
}

async function fetchMinimaxUsage() {
  const baseInfo = { provider: 'minimax', name: AI_PROVIDERS.minimax.name, icon: AI_PROVIDERS.minimax.icon };

  const apiKey = process.env.MINIMAX_API_KEY || process.env.MINIMAX_CN_API_KEY || process.env.MINIMAX_API_TOKEN;
  if (!apiKey) {
    return { ...baseInfo, error: 'Set MINIMAX_API_KEY environment variable.' };
  }

  try {
    const resp = await fetch('https://api.minimax.io/v1/api/openplatform/coding_plan/remains', {
      headers: { 'Authorization': `Bearer ${apiKey}`, 'Accept': 'application/json' },
    });

    if (!resp.ok) {
      if (resp.status === 401 || resp.status === 403) return { ...baseInfo, error: 'Invalid API key.' };
      return { ...baseInfo, error: `API error (HTTP ${resp.status})` };
    }

    const data = await resp.json();
    if (data.base_resp?.status_code !== 0) {
      return { ...baseInfo, error: data.base_resp?.status_msg || 'API error' };
    }

    const metrics = [];
    const model = data.model_remains?.[0];
    if (model) {
      const total = model.current_interval_total_count || 100;
      const remaining = model.current_interval_usage_count || model.current_interval_remaining_count || 0;
      const used = ((total - remaining) / total) * 100;
      metrics.push({ label: 'Session', used, limit: 100, format: 'percent' });
    }

    return { ...baseInfo, plan: data.current_subscribe_title || 'MiniMax', metrics };
  } catch (e) { return { ...baseInfo, error: 'Network error: ' + e.message }; }
}

async function fetchZaiUsage() {
  const baseInfo = { provider: 'zai', name: AI_PROVIDERS.zai.name, icon: AI_PROVIDERS.zai.icon };

  const apiKey = process.env.ZAI_API_KEY || process.env.GLM_API_KEY;
  if (!apiKey) {
    return { ...baseInfo, error: 'Set ZAI_API_KEY environment variable.' };
  }

  try {
    const resp = await fetch('https://api.z.ai/api/monitor/usage/quota/limit', {
      headers: { 'Authorization': `Bearer ${apiKey}`, 'Accept': 'application/json' },
    });

    if (!resp.ok) {
      if (resp.status === 401 || resp.status === 403) return { ...baseInfo, error: 'Invalid API key.' };
      return { ...baseInfo, error: `API error (HTTP ${resp.status})` };
    }

    const data = await resp.json();
    if (data.code !== 200) {
      return { ...baseInfo, error: data.message || 'API error' };
    }

    const metrics = [];
    for (const limit of (data.data?.limits || [])) {
      if (limit.type === 'TOKENS_LIMIT') {
        metrics.push({ label: 'Session', used: limit.percentage || 0, limit: 100, format: 'percent' });
      } else if (limit.type === 'TIME_LIMIT') {
        metrics.push({ label: 'Weekly', used: limit.percentage || 0, limit: 100, format: 'percent' });
      }
    }

    return { ...baseInfo, plan: 'GLM Coding', metrics };
  } catch (e) { return { ...baseInfo, error: 'Network error: ' + e.message }; }
}

async function fetchAntigravityUsage() {
  const baseInfo = { provider: 'antigravity', name: AI_PROVIDERS.antigravity.name, icon: AI_PROVIDERS.antigravity.icon };
  const providerConfig = AI_PROVIDERS.antigravity;

  let activeAccount;
  try {
    const configData = JSON.parse(fs.readFileSync(providerConfig.configPath, 'utf8'));
    activeAccount = configData.activeAccount;
  } catch (_) {
    return { ...baseInfo, error: 'Run: antigravity-usage login' };
  }

  if (!activeAccount) {
    return { ...baseInfo, error: 'No active account configured.' };
  }

  const tokensPath = path.join(providerConfig.accountsDir, activeAccount, 'tokens.json');
  let tokens;
  try {
    tokens = JSON.parse(fs.readFileSync(tokensPath, 'utf8'));
  } catch (_) {
    return { ...baseInfo, error: 'Token file not found for ' + activeAccount };
  }

  let accessToken = tokens.accessToken;
  if (tokens.expiresAt && Date.now() > tokens.expiresAt - 60000) {
    const clientId = process.env.ANTIGRAVITY_CLIENT_ID;
    const clientSecret = process.env.ANTIGRAVITY_CLIENT_SECRET;

    if (!clientId || !clientSecret) {
      return { ...baseInfo, error: 'Token expired. Run `antigravity-usage` to refresh, or set ANTIGRAVITY_CLIENT_ID/SECRET env vars.' };
    }

    try {
      const refreshResp = await fetch(providerConfig.tokenUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          client_id: clientId,
          client_secret: clientSecret,
          refresh_token: tokens.refreshToken,
          grant_type: 'refresh_token',
        }),
      });
      if (!refreshResp.ok) {
        return { ...baseInfo, error: 'Token refresh failed (HTTP ' + refreshResp.status + ')' };
      }
      const refreshData = await refreshResp.json();
      accessToken = refreshData.access_token;
      tokens.accessToken = accessToken;
      tokens.expiresAt = Date.now() + (refreshData.expires_in * 1000);
      try { fs.writeFileSync(tokensPath, JSON.stringify(tokens, null, 2)); } catch (_) {}
    } catch (e) {
      return { ...baseInfo, error: 'Token refresh error: ' + e.message };
    }
  }

  try {
    const resp = await fetch(providerConfig.apiUrl, {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer ' + accessToken,
        'Content-Type': 'application/json',
        'User-Agent': 'antigravity',
      },
      body: JSON.stringify({ project: tokens.projectId }),
    });

    if (!resp.ok) {
      if (resp.status === 401 || resp.status === 403) return { ...baseInfo, error: 'Auth failed. Re-run: antigravity-usage login' };
      if (resp.status === 429) return { ...baseInfo, error: 'Rate limited. Try again later.' };
      return { ...baseInfo, error: 'API error (HTTP ' + resp.status + ')' };
    }

    const data = await resp.json();
    const models = data.models || {};

    const metrics = [];
    const interestingModels = ['gemini-3-pro-high', 'gemini-3-pro-low', 'claude-sonnet-4-6', 'claude-opus-4-6-thinking'];

    for (const modelId of interestingModels) {
      const model = models[modelId];
      if (model && model.quotaInfo) {
        const remaining = model.quotaInfo.remainingFraction ?? 1;
        metrics.push({
          label: model.displayName || modelId,
          used: Math.round((1 - remaining) * 100),
          limit: 100,
          format: 'percent',
          resetTime: model.quotaInfo.resetTime,
        });
      }
    }

    if (metrics.length === 0) {
      for (const [modelId, model] of Object.entries(models).slice(0, 4)) {
        if (model.quotaInfo) {
          const remaining = model.quotaInfo.remainingFraction ?? 1;
          metrics.push({
            label: model.displayName || modelId,
            used: Math.round((1 - remaining) * 100),
            limit: 100,
            format: 'percent',
          });
        }
      }
    }

    return { ...baseInfo, plan: activeAccount, metrics };
  } catch (e) {
    return { ...baseInfo, error: 'Network error: ' + e.message };
  }
}

const aiUsageCache = {
  claude: { data: null, timestamp: 0 },
  codex: { data: null, timestamp: 0 },
  copilot: { data: null, timestamp: 0 },
  cursor: { data: null, timestamp: 0 },
  gemini: { data: null, timestamp: 0 },
  factory: { data: null, timestamp: 0 },
  kimi: { data: null, timestamp: 0 },
  jetbrains: { data: null, timestamp: 0 },
  minimax: { data: null, timestamp: 0 },
  zai: { data: null, timestamp: 0 },
  amp: { data: null, timestamp: 0 },
  antigravity: { data: null, timestamp: 0 },
};
const AI_CACHE_TTL_MS = 300000;

const AI_CACHE_FILE = path.join(CWD, 'data', 'ai-usage-cache.json');

function loadPersistentCache() {
  try {
    if (fs.existsSync(AI_CACHE_FILE)) {
      const data = JSON.parse(fs.readFileSync(AI_CACHE_FILE, 'utf8'));
      for (const [provider, entry] of Object.entries(data)) {
        if (aiUsageCache[provider] && entry.data) {
          aiUsageCache[provider] = entry;
        }
      }
      console.log('[AI Cache] Loaded persistent cache');
    }
  } catch (e) { /* ignore */ }
}

function savePersistentCache() {
  try {
    fs.mkdirSync(path.dirname(AI_CACHE_FILE), { recursive: true });
    fs.writeFileSync(AI_CACHE_FILE, JSON.stringify(aiUsageCache, null, 2));
  } catch (e) { /* ignore */ }
}

loadPersistentCache();

async function fetchWithCache(provider, fetchFn) {
  const cache = aiUsageCache[provider];
  const now = Date.now();

  if (cache.data && (now - cache.timestamp) < AI_CACHE_TTL_MS) {
    return { ...cache.data, cached: true };
  }

  const result = await fetchFn();

  if (!result.error) {
    cache.data = result;
    cache.timestamp = now;
    savePersistentCache();
  } else if (result.error.includes('429') || result.error.includes('rate')) {
    if (cache.data) {
      return { ...cache.data, cached: true, stale: true, rateLimited: true };
    }
  }

  return result;
}

async function getAllAiUsage(options = {}) {
  const results = await Promise.all([
    fetchWithCache('claude', fetchClaudeUsage),
    fetchWithCache('codex', fetchCodexUsage),
    fetchWithCache('copilot', fetchCopilotUsage),
    fetchWithCache('cursor', fetchCursorUsage),
    fetchWithCache('gemini', fetchGeminiUsage),
    fetchWithCache('amp', fetchAmpUsage),
    fetchWithCache('factory', fetchFactoryUsage),
    fetchWithCache('kimi', fetchKimiUsage),
    fetchWithCache('jetbrains', fetchJetbrainsUsage),
    fetchWithCache('minimax', fetchMinimaxUsage),
    fetchWithCache('zai', fetchZaiUsage),
    fetchWithCache('antigravity', fetchAntigravityUsage),
  ]);

  return {
    providers: results,
    timestamp: new Date().toISOString(),
  };
}

module.exports = {
  AI_PROVIDERS,
  readCredentials,
  refreshClaudeToken,
  fetchClaudeUsage,
  fetchCodexUsage,
  fetchCopilotUsage,
  fetchCursorUsage,
  fetchGeminiUsage,
  fetchAmpUsage,
  fetchFactoryUsage,
  fetchKimiUsage,
  fetchJetbrainsUsage,
  fetchMinimaxUsage,
  fetchZaiUsage,
  fetchAntigravityUsage,
  aiUsageCache,
  fetchWithCache,
  getAllAiUsage,
};
