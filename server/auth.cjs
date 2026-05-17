const crypto = require('crypto');

const DASHBOARD_PASSWORD = process.env.DASHBOARD_PASSWORD || null;
const SESSION_TTL_MS = (parseInt(process.env.SESSION_TTL_HOURS) || 24) * 60 * 60 * 1000;
const TRUSTED_DEVICE_TTL_MS = (parseInt(process.env.TRUSTED_DEVICE_TTL_DAYS) || 30) * 24 * 60 * 60 * 1000;

const sessions = new Map();

const loginAttempts = new Map();
const MAX_LOGIN_ATTEMPTS = 5;
const LOCKOUT_MS = 15 * 60 * 1000;

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
  return [
    'Path=/',
    'HttpOnly',
    'SameSite=Strict',
    `Max-Age=${Math.floor(maxAgeSeconds)}`,
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
  return crypto
    .createHmac('sha256', `lb-trusted-device:${DASHBOARD_PASSWORD || ''}`)
    .update(`${exp}.${nonce}`)
    .digest('hex');
}

function createTrustedDeviceToken(now = Date.now()) {
  if (!DASHBOARD_PASSWORD) return null;
  const exp = now + TRUSTED_DEVICE_TTL_MS;
  const nonce = crypto.randomBytes(16).toString('hex');
  const sig = trustedDeviceSignature(exp, nonce);
  return `${exp}.${nonce}.${sig}`;
}

function isValidTrustedDevice(token) {
  if (!DASHBOARD_PASSWORD || !token) return false;
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
  if (!DASHBOARD_PASSWORD || !input) return false;
  const inputHash = crypto.createHmac('sha256', 'lb-session-auth').update(String(input)).digest();
  const correctHash = crypto.createHmac('sha256', 'lb-session-auth').update(DASHBOARD_PASSWORD).digest();
  return crypto.timingSafeEqual(inputHash, correctHash);
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
