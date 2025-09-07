// Entry point for the backend server
const express = require('express');
const path = require('path');
const bodyParser = require('body-parser');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const rateLimit = require('express-rate-limit');

const app = express();
// Trust the reverse proxy (Render, etc.) so express-rate-limit can use X-Forwarded-For
app.set('trust proxy', true);
const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3001;
// Use environment variable for the JWT secret in production. Falling back to a default for dev.
const SECRET = process.env.JWT_SECRET || 'your_jwt_secret';
// Optional cookie domain to scope cookies to a parent domain (e.g. .onrender.com)
// Default to the parent onrender.com domain so cookies are usable across Render preview subdomains.
// You can still override by setting COOKIE_DOMAIN in the environment if you prefer.
const COOKIE_DOMAIN = process.env.COOKIE_DOMAIN || '.onrender.com';
if (!process.env.JWT_SECRET) {
  console.warn('Warning: JWT_SECRET is not set. Using default development secret. Do NOT use this in production.');
}

// CORS: allow credentials and echo the request origin back so browsers receive
// Access-Control-Allow-Origin matching their request when credentials are used.
// This is safer than hard-coding a single origin when the app may be served
// from different subdomains (Render preview / production, etc.).
// Note: leaving an explicit whitelist in CLIENT_ORIGIN (comma-separated) is
// still supported via environment configuration; when not set we echo origin.
app.use((req, res, next) => {
  // ensure Vary: Origin so caches treat responses per-origin
  res.header('Vary', 'Origin');
  const originHeader = req.get('origin');
  const allowed = (process.env.CLIENT_ORIGIN || '').split(',').map(s => s.trim()).filter(Boolean);
  // If a whitelist is provided, only echo back origins on the list. Otherwise echo any origin.
  const origin = (allowed.length === 0) ? originHeader : (allowed.includes(originHeader) ? originHeader : false);
  cors({ origin: origin, credentials: true })(req, res, next);
});
app.use(bodyParser.json());
app.use(cookieParser());

// Serve client static files so the SPA and API can share the same origin.
// This avoids third-party cookie issues when the client and API are on different subdomains.
const clientStatic = path.join(__dirname, '..', 'client');
app.use(express.static(clientStatic));
app.get('/', (req, res) => {
  res.sendFile(path.join(clientStatic, 'index.html'));
});

// Basic rate limiter for auth endpoints to slow brute-force attempts
const authLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 10, // limit each IP to 10 requests per windowMs
  standardHeaders: true,
  legacyHeaders: false,
});

// Initialize SQLite DB
const db = new sqlite3.Database('database.sqlite', (err) => {
  if (err) throw err;
  console.log('Connected to SQLite database.');
});

db.serialize(() => {
  db.run(`CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL
  )`);
  db.run(`CREATE TABLE IF NOT EXISTS refresh_tokens (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    token TEXT NOT NULL,
    created_at INTEGER DEFAULT (strftime('%s','now')),
    FOREIGN KEY(user_id) REFERENCES users(id)
  )`);
  db.run(`CREATE TABLE IF NOT EXISTS creature_cards (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    data TEXT NOT NULL,
    FOREIGN KEY(user_id) REFERENCES users(id)
  )`);
});

// Register endpoint
app.post('/api/register', authLimiter, (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ error: 'Missing email or password' });
  bcrypt.hash(password, 10, (err, hash) => {
    if (err) return res.status(500).json({ error: 'Server error' });
    db.run('INSERT INTO users (email, password) VALUES (?, ?)', [email, hash], function(err) {
      if (err) return res.status(400).json({ error: 'Email already exists' });
      const userId = this.lastID;
      // Issue tokens and set cookies
      console.log(`[AUTH] register success for user ${email} (id=${userId}) from ${req.ip}`);
      try {
        issueTokensAndSetCookies(req, res, userId);
        return res.status(201).json({ success: true, user: { id: userId, email } });
      } catch (e) { console.error('[AUTH] issueTokensAndSetCookies failed on register', e); return res.status(500).json({ error: 'Failed to create tokens' }); }
    });
  });
});

// Login endpoint
app.post('/api/login', authLimiter, (req, res) => {
  const { email, password } = req.body;
  db.get('SELECT * FROM users WHERE email = ?', [email], (err, user) => {
    if (err || !user) return res.status(400).json({ error: 'Invalid credentials' });
    bcrypt.compare(password, user.password, (err, result) => {
      if (result) {
        try {
          issueTokensAndSetCookies(req, res, user.id);
          console.log(`[AUTH] login success for user ${email} (id=${user.id}) from ${req.ip}`);
          return res.json({ success: true, user: { id: user.id, email: user.email } });
        } catch (e) { console.error('[AUTH] issueTokensAndSetCookies failed on login', e); return res.status(500).json({ error: 'Failed to create tokens' }); }
      } else {
        res.status(400).json({ error: 'Invalid credentials' });
      }
    });
  });
});

// Helper to issue access and refresh tokens and set them as httpOnly cookies
// Derive a cookie domain (parent domain) from an Origin header when possible.
function cookieDomainFromOrigin(origin) {
  try {
    if (!origin) return undefined;
    const u = new URL(origin);
    const host = u.hostname; // e.g. nuggie-1.onrender.com
    if (!host || host === 'localhost' || host === '127.0.0.1') return undefined;
    const parts = host.split('.');
    if (parts.length < 2) return undefined;
    // Join last two labels to form base domain (onrender.com)
    const base = parts.slice(-2).join('.');
    return '.' + base; // leading dot to allow subdomain sharing
  } catch (e) { return undefined; }
}

function issueTokensAndSetCookies(req, res, userId) {
  const accessToken = jwt.sign({ userId }, SECRET, { expiresIn: '15m' });
  const refreshToken = jwt.sign({ userId }, SECRET, { expiresIn: '7d' });
  // store refresh token server-side
  db.run('INSERT INTO refresh_tokens (user_id, token) VALUES (?, ?)', [userId, refreshToken], function(err) { if (err) console.warn('Failed to persist refresh token', err); });
  const secureFlag = (process.env.NODE_ENV === 'production');
  // For cross-origin requests (client and API on different origins) cookies must use SameSite='None' and Secure
  const sameSiteSetting = secureFlag ? 'none' : 'lax';
  // Use explicit expires to avoid any ambiguity in how browsers interpret Max-Age
  const accessExpires = new Date(Date.now() + (15 * 60 * 1000));
  const refreshExpires = new Date(Date.now() + (7 * 24 * 60 * 60 * 1000));
  const accessCookieOptions = { httpOnly: true, sameSite: sameSiteSetting, secure: secureFlag, expires: accessExpires, path: '/' };
  const refreshCookieOptions = { httpOnly: true, sameSite: sameSiteSetting, secure: secureFlag, expires: refreshExpires, path: '/' };
  // Pick domain: explicit env wins, otherwise try deriving from request Origin header
  const derivedDomain = COOKIE_DOMAIN || cookieDomainFromOrigin(req.get('origin'));
  if (derivedDomain) {
    accessCookieOptions.domain = derivedDomain;
    refreshCookieOptions.domain = derivedDomain;
  }
  res.cookie('accessToken', accessToken, accessCookieOptions);
  res.cookie('refreshToken', refreshToken, refreshCookieOptions);
  // Debug: log cookie issuance metadata (do not print token values)
  console.log('[AUTH] issued cookies', { userId, secure: accessCookieOptions.secure, sameSite: accessCookieOptions.sameSite, domain: accessCookieOptions.domain || '<none>', accessExpires: accessCookieOptions.expires, refreshExpires: refreshCookieOptions.expires, httpOnly: accessCookieOptions.httpOnly });
}

// Auth middleware
function authenticateToken(req, res, next) {
  // Debug: log origin and cookie header to check whether browser sent cookies
  try {
    const origin = req.get('origin') || '<none>';
    const cookieHeader = req.headers && req.headers.cookie ? '[present]' : '<none>';
    const cookieKeys = Object.keys(req.cookies || {}).join(',') || '<none>';
    console.log(`[AUTH] authenticateToken: origin=${origin} cookieHeader=${cookieHeader} cookieKeys=${cookieKeys} path=${req.path}`);
  } catch (e) { /* ignore logging errors */ }

  // Read access token from httpOnly cookie
  const token = req.cookies && req.cookies.accessToken;
  if (!token) return res.status(401).json({ error: 'Missing access token' });
  jwt.verify(token, SECRET, (err, user) => {
    if (err) return res.status(403).json({ error: 'Invalid or expired access token' });
    req.user = user;
    next();
  });
}

// Save creature card
app.post('/api/creature', authenticateToken, (req, res) => {
  const { data } = req.body;
  db.run('INSERT INTO creature_cards (user_id, data) VALUES (?, ?)', [req.user.userId, JSON.stringify(data)], function(err) {
  if (err) { console.error('[DATA] failed to save creature for user', req.user.userId, err); return res.status(500).json({ error: 'Failed to save' }); }
  res.status(201).json({ success: true, id: this.lastID });
  });
});

// Get all creature cards for user
app.get('/api/creature', authenticateToken, (req, res) => {
  db.all('SELECT id, data FROM creature_cards WHERE user_id = ?', [req.user.userId], (err, rows) => {
    if (err) return res.status(500).json({ error: 'Failed to load' });
    res.json(rows.map(row => ({ id: row.id, ...JSON.parse(row.data) })));
  });
});

// Simple endpoint for the client to fetch the current user's profile
app.get('/api/me', authenticateToken, (req, res) => {
  db.get('SELECT id, email FROM users WHERE id = ?', [req.user.userId], (err, user) => {
    if (err || !user) return res.status(500).json({ error: 'Failed to load user' });
    res.json({ id: user.id, email: user.email });
  });
});

// Debug endpoint: returns parsed cookies and raw Cookie header so the client can verify
// whether cookies are being sent by the browser on cross-origin requests.
app.get('/api/debug-cookies', (req, res) => {
  try {
    return res.json({ cookies: req.cookies || {}, cookieHeader: req.headers.cookie || null });
  } catch (e) {
    return res.status(500).json({ error: 'debug failed' });
  }
});

// Refresh endpoint: issues a fresh access token (and rotates refresh token)
app.post('/api/refresh', (req, res) => {
  // Debug: log origin and cookie header to help diagnose missing refresh token
  try {
    const origin = req.get('origin') || '<none>';
    const cookieHeader = req.headers && req.headers.cookie ? '[present]' : '<none>';
    const cookieKeys = Object.keys(req.cookies || {}).join(',') || '<none>';
    console.log(`[AUTH] refresh: origin=${origin} cookieHeader=${cookieHeader} cookieKeys=${cookieKeys}`);
  } catch (e) {}

  const refreshToken = req.cookies && req.cookies.refreshToken;
  if (!refreshToken) return res.status(401).json({ error: 'Missing refresh token' });
  jwt.verify(refreshToken, SECRET, (err, payload) => {
    if (err) return res.status(403).json({ error: 'Invalid or expired refresh token' });
    const userId = payload.userId;
    // confirm refresh token exists in DB
    db.get('SELECT id FROM refresh_tokens WHERE user_id = ? AND token = ?', [userId, refreshToken], (dbErr, row) => {
      if (dbErr || !row) {
        console.warn('[AUTH] refresh: refresh token not found in DB for user', userId, 'dbErr=', dbErr);
        return res.sendStatus(403);
      }
      // rotate refresh token: delete old and create new
      const newAccess = jwt.sign({ userId }, SECRET, { expiresIn: '15m' });
      const newRefresh = jwt.sign({ userId }, SECRET, { expiresIn: '7d' });
      db.run('DELETE FROM refresh_tokens WHERE id = ?', [row.id], function(dErr) {
        if (dErr) console.warn('Failed to delete old refresh token', dErr);
        db.run('INSERT INTO refresh_tokens (user_id, token) VALUES (?, ?)', [userId, newRefresh], function(iErr) { if (iErr) console.warn('Failed to insert new refresh token', iErr); });
        const secureFlag = (process.env.NODE_ENV === 'production');
        const sameSiteSetting = secureFlag ? 'none' : 'lax';
        const accessExpires = new Date(Date.now() + (15 * 60 * 1000));
        const refreshExpires = new Date(Date.now() + (7 * 24 * 60 * 60 * 1000));
        const accessCookieOptions = { httpOnly: true, sameSite: sameSiteSetting, secure: secureFlag, expires: accessExpires, path: '/' };
        const refreshCookieOptions = { httpOnly: true, sameSite: sameSiteSetting, secure: secureFlag, expires: refreshExpires, path: '/' };
        // derive domain for rotated cookies as well
        const derivedDomain = COOKIE_DOMAIN || cookieDomainFromOrigin(req.get('origin'));
        if (derivedDomain) {
          accessCookieOptions.domain = derivedDomain;
          refreshCookieOptions.domain = derivedDomain;
        }
        res.cookie('accessToken', newAccess, accessCookieOptions);
        res.cookie('refreshToken', newRefresh, refreshCookieOptions);
        console.log(`[AUTH] refresh issued for user ${userId} from ${req.ip}`);
        return res.json({ success: true });
      });
    });
  });
});

// Logout: remove refresh token and clear cookies
app.post('/api/logout', (req, res) => {
  const refreshToken = req.cookies && req.cookies.refreshToken;
  if (refreshToken) {
    // remove from DB
    db.run('DELETE FROM refresh_tokens WHERE token = ?', [refreshToken], function(err) { if (err) console.warn('Failed to delete refresh token', err); });
  }
  // clear cookies
  const clearOpts = { path: '/' };
  // Use derived domain so clear matches how cookies were set
  const derivedDomain = COOKIE_DOMAIN || cookieDomainFromOrigin(req.get('origin'));
  if (derivedDomain) clearOpts.domain = derivedDomain;
  res.clearCookie('accessToken', clearOpts);
  res.clearCookie('refreshToken', clearOpts);
  res.json({ success: true });
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
