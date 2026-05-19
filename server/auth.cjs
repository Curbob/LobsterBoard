const crypto = require('crypto');
const { execFileSync } = require('child_process');

const DASHBOARD_PASSWORD = process.env.DASHBOARD_PASSWORD || null;
const CODEX_DASHBOARD_PASSWORD = process.env.CODEX_DASHBOARD_PASSWORD || loadKeychainPassword({
  service: process.env.CODEX_DASHBOARD_PASSWORD_KEYCHAIN_SERVICE,
  account: process.env.CODEX_DASHBOARD_PASSWORD_KEYCHAIN_ACCOUNT || 'codex',
});
const CODEX_DASHBOARD_PASSWORD_HASH = process.env.CODEX_DASHBOARD_PASSWORD_HASH || null;
const SESSION_TTL_MS = (parseInt(process.env.SESSION_TTL_HOURS) || 24) * 60 * 60 * 1000;
const TRUSTED_DEVICE_TTL_MS = (parseInt(process.env.TRUSTED_DEVICE_TTL_DAYS) || 30) * 24 * 60 * 60 * 1000;

const sessions = new Map();

const loginAttempts = new Map();
const MAX_LOGIN_ATTEMPTS = 5;
const LOCKOUT_MS = 15 * 60 * 1000;

function loadKeychainPassword({ service, account }) {
  if (!service) return null;
  try {
    const value = execFileSync('/usr/bin/security', [
      'find-generic-password',
      '-w',
      '-s',
      service,
      '-a',
      account,
    ], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
      timeout: 1500,
    }).trim();
    return value || null;
  } catch (_) {
    return null;
  }
}

function generateSessionToken() {
  return crypto.randomBytes(32).toString('hex');
}

function createSession() {
  const token = generateSessionToken();
  sessions.set(token, Date.now() + SESSION_TTL_MS);
  return token;
}

function isValidSession(token) {
  if (!token || !/^[a-f0-9]{64}$/.test(token)) return false;
  const exp = sessions.get(token);
  if (!exp) return false;
  if (Date.now() > exp) { sessions.delete(token); return false; }
  return true;
}

function getSessionCookie(req) {
  const cookie = req.headers.cookie || '';
  const match = cookie.match(/(?:^|;\s*)lb_session=([a-f0-9]{64})/);
  return match ? match[1] : null;
}

function getTrustedCookie(req) {
  const cookie = req.headers.cookie || '';
  const match = cookie.match(/(?:^|;\s*)lb_trusted=([^;]+)/);
  return match ? decodeURIComponent(match[1]) : null;
}

function getCookieOptions(req, maxAgeSeconds) {
  const host = req.headers.host || '';
  const forwardedProto = req.headers['x-forwarded-proto'];
  const isHttps = req.socket.encrypted || forwardedProto === 'https' || host.includes('.ts.net');
  const expires = new Date(Date.now() + (Math.max(0, maxAgeSeconds) * 1000)).toUTCString();
  return [
    'Path=/',
    'HttpOnly',
    'SameSite=Lax',
    `Max-Age=${Math.floor(maxAgeSeconds)}`,
    `Expires=${expires}`,
    isHttps ? 'Secure' : null,
  ].filter(Boolean).join('; ');
}

function sessionCookieHeader(req, token) {
  return `lb_session=${token}; ${getCookieOptions(req, SESSION_TTL_MS / 1000)}`;
}

function clearSessionCookie(req) {
  return `lb_session=; ${getCookieOptions(req, 0)}`;
}

function trustedDeviceSignature(exp, nonce) {
  const signingSecret = DASHBOARD_PASSWORD || CODEX_DASHBOARD_PASSWORD || CODEX_DASHBOARD_PASSWORD_HASH || '';
  return crypto
    .createHmac('sha256', `lb-trusted-device:${signingSecret}`)
    .update(`${exp}.${nonce}`)
    .digest('hex');
}

function createTrustedDeviceToken(now = Date.now()) {
  if (!DASHBOARD_PASSWORD && !CODEX_DASHBOARD_PASSWORD && !CODEX_DASHBOARD_PASSWORD_HASH) return null;
  const exp = now + TRUSTED_DEVICE_TTL_MS;
  const nonce = crypto.randomBytes(16).toString('hex');
  const sig = trustedDeviceSignature(exp, nonce);
  return `${exp}.${nonce}.${sig}`;
}

function isValidTrustedDevice(token) {
  if ((!DASHBOARD_PASSWORD && !CODEX_DASHBOARD_PASSWORD && !CODEX_DASHBOARD_PASSWORD_HASH) || !token) return false;
  const parts = String(token).split('.');
  if (parts.length !== 3) return false;
  const [expRaw, nonce, sig] = parts;
  if (!/^\d{10,16}$/.test(expRaw) || !/^[a-f0-9]{32}$/.test(nonce) || !/^[a-f0-9]{64}$/.test(sig)) return false;
  const exp = Number(expRaw);
  if (!Number.isFinite(exp) || Date.now() > exp) return false;
  const expected = trustedDeviceSignature(expRaw, nonce);
  return crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected));
}

function trustedDeviceCookieHeader(req, token) {
  return `lb_trusted=${encodeURIComponent(token)}; ${getCookieOptions(req, TRUSTED_DEVICE_TTL_MS / 1000)}`;
}

function clearTrustedDeviceCookie(req) {
  return `lb_trusted=; ${getCookieOptions(req, 0)}`;
}

function checkPassword(input) {
  if ((!DASHBOARD_PASSWORD && !CODEX_DASHBOARD_PASSWORD && !CODEX_DASHBOARD_PASSWORD_HASH) || !input) return false;
  const inputHash = crypto.createHmac('sha256', 'lb-session-auth').update(String(input)).digest();
  const candidates = [DASHBOARD_PASSWORD, CODEX_DASHBOARD_PASSWORD].filter(Boolean);
  if (candidates.some((candidate) => {
    const correctHash = crypto.createHmac('sha256', 'lb-session-auth').update(candidate).digest();
    return crypto.timingSafeEqual(inputHash, correctHash);
  })) return true;
  if (!/^[a-f0-9]{64}$/.test(String(CODEX_DASHBOARD_PASSWORD_HASH || ''))) return false;
  return crypto.timingSafeEqual(inputHash, Buffer.from(CODEX_DASHBOARD_PASSWORD_HASH, 'hex'));
}

function isRateLimited(ip) {
  const entry = loginAttempts.get(ip);
  if (!entry) return false;
  if (Date.now() > entry.resetAt) { loginAttempts.delete(ip); return false; }
  return entry.count >= MAX_LOGIN_ATTEMPTS;
}

function recordFailedAttempt(ip) {
  const entry = loginAttempts.get(ip) || { count: 0, resetAt: Date.now() + LOCKOUT_MS };
  entry.count++;
  loginAttempts.set(ip, entry);
}

function hashPin(pin) {
  return crypto.createHash('sha256').update(pin).digest('hex');
}

setInterval(() => {
  const now = Date.now();
  for (const [token, exp] of sessions) {
    if (now > exp) sessions.delete(token);
  }
}, 60 * 60 * 1000);

module.exports = {
  DASHBOARD_PASSWORD,
  CODEX_DASHBOARD_PASSWORD,
  CODEX_DASHBOARD_PASSWORD_HASH,
  SESSION_TTL_MS,
  TRUSTED_DEVICE_TTL_MS,
  sessions,
  generateSessionToken,
  createSession,
  isValidSession,
  getSessionCookie,
  getTrustedCookie,
  createTrustedDeviceToken,
  isValidTrustedDevice,
  sessionCookieHeader,
  trustedDeviceCookieHeader,
  clearSessionCookie,
  clearTrustedDeviceCookie,
  checkPassword,
  isRateLimited,
  recordFailedAttempt,
  hashPin,
};
