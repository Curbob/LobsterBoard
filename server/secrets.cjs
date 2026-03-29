const config = require('./config.cjs');
const { AUTH_FILE, SECRETS_FILE, readJsonFile, writeJsonFile } = config;

const SENSITIVE_KEYS = ['apiKey', 'api_key', 'token', 'secret', 'password', 'icalUrl'];

function isSensitiveKey(key) {
  return SENSITIVE_KEYS.includes(key);
}

function getAuth() { return readJsonFile(AUTH_FILE, {}); }
function getSecrets() { return readJsonFile(SECRETS_FILE, {}); }

function isPublicMode() {
  const auth = getAuth();
  return auth.publicMode === true;
}

function maskConfig(config) {
  const secrets = getSecrets();
  const masked = JSON.parse(JSON.stringify(config));
  if (masked.widgets) {
    masked.widgets.forEach(w => {
      if (!w.properties) return;
      const widgetSecrets = secrets[w.id] || {};
      for (const key of Object.keys(w.properties)) {
        if (isSensitiveKey(key) && (w.properties[key] === '__SECRET__' || widgetSecrets[key])) {
          w.properties[key] = '••••••••';
        }
      }
    });
  }
  return masked;
}

function extractSecrets(cfg) {
  const secrets = getSecrets();
  if (cfg.widgets) {
    cfg.widgets.forEach(w => {
      if (!w.properties) return;
      for (const key of Object.keys(w.properties)) {
        if (isSensitiveKey(key)) {
          const val = w.properties[key];
          if (val && val !== '__SECRET__' && val !== '••••••••') {
            if (!secrets[w.id]) secrets[w.id] = {};
            secrets[w.id][key] = val;
            w.properties[key] = '__SECRET__';
          } else if (val === '••••••••') {
            w.properties[key] = '__SECRET__';
          }
        }
      }
    });
  }
  writeJsonFile(SECRETS_FILE, secrets);
  return cfg;
}

module.exports = {
  SENSITIVE_KEYS,
  isSensitiveKey,
  isPublicMode,
  maskConfig,
  extractSecrets,
  getAuth,
  getSecrets,
};
