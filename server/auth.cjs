const crypto = require('crypto');

const DASHBOARD_PASSWORD = process.env.DASHBOARD_PASSWORD || null;
const SESSION_TTL_MS = (parseInt(process.env.SESSION_TTL_HOURS) || 24) * 60 * 60 * 1000;

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
  sessions,
  generateSessionToken,
  createSession,
  isValidSession,
  getSessionCookie,
  checkPassword,
  isRateLimited,
  recordFailedAttempt,
  hashPin,
};
