// Entry point for the backend server
const express = require('express');
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
if (!process.env.JWT_SECRET) {
  console.warn('Warning: JWT_SECRET is not set. Using default development secret. Do NOT use this in production.');
}

// CORS: allow credentials and configure allowed origin via env. For local testing default to http://localhost:3000
app.use(cors({ origin: process.env.CLIENT_ORIGIN || 'http://localhost:3000', credentials: true }));
app.use(bodyParser.json());
app.use(cookieParser());

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
      try { issueTokensAndSetCookies(res, userId); return res.json({ success: true }); } catch (e) { return res.status(500).json({ error: 'Failed to create tokens' }); }
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
        try { issueTokensAndSetCookies(res, user.id); return res.json({ success: true }); } catch (e) { return res.status(500).json({ error: 'Failed to create tokens' }); }
      } else {
        res.status(400).json({ error: 'Invalid credentials' });
      }
    });
  });
});

// Helper to issue access and refresh tokens and set them as httpOnly cookies
function issueTokensAndSetCookies(res, userId) {
  const accessToken = jwt.sign({ userId }, SECRET, { expiresIn: '15m' });
  const refreshToken = jwt.sign({ userId }, SECRET, { expiresIn: '7d' });
  // store refresh token server-side
  db.run('INSERT INTO refresh_tokens (user_id, token) VALUES (?, ?)', [userId, refreshToken], function(err) { if (err) console.warn('Failed to persist refresh token', err); });
  const secureFlag = (process.env.NODE_ENV === 'production');
  res.cookie('accessToken', accessToken, { httpOnly: true, sameSite: 'lax', secure: secureFlag, maxAge: 15 * 60 * 1000 });
  res.cookie('refreshToken', refreshToken, { httpOnly: true, sameSite: 'lax', secure: secureFlag, maxAge: 7 * 24 * 60 * 60 * 1000 });
}

// Auth middleware
function authenticateToken(req, res, next) {
  // Read access token from httpOnly cookie
  const token = req.cookies && req.cookies.accessToken;
  if (!token) return res.sendStatus(401);
  jwt.verify(token, SECRET, (err, user) => {
    if (err) return res.sendStatus(403);
    req.user = user;
    next();
  });
}

// Save creature card
app.post('/api/creature', authenticateToken, (req, res) => {
  const { data } = req.body;
  db.run('INSERT INTO creature_cards (user_id, data) VALUES (?, ?)', [req.user.userId, JSON.stringify(data)], function(err) {
    if (err) return res.status(500).json({ error: 'Failed to save' });
    res.json({ id: this.lastID });
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

// Refresh endpoint: issues a fresh access token (and rotates refresh token)
app.post('/api/refresh', (req, res) => {
  const refreshToken = req.cookies && req.cookies.refreshToken;
  if (!refreshToken) return res.sendStatus(401);
  jwt.verify(refreshToken, SECRET, (err, payload) => {
    if (err) return res.sendStatus(403);
    const userId = payload.userId;
    // confirm refresh token exists in DB
    db.get('SELECT id FROM refresh_tokens WHERE user_id = ? AND token = ?', [userId, refreshToken], (dbErr, row) => {
      if (dbErr || !row) return res.sendStatus(403);
      // rotate refresh token: delete old and create new
      const newAccess = jwt.sign({ userId }, SECRET, { expiresIn: '15m' });
      const newRefresh = jwt.sign({ userId }, SECRET, { expiresIn: '7d' });
      db.run('DELETE FROM refresh_tokens WHERE id = ?', [row.id], function(dErr) {
        if (dErr) console.warn('Failed to delete old refresh token', dErr);
        db.run('INSERT INTO refresh_tokens (user_id, token) VALUES (?, ?)', [userId, newRefresh], function(iErr) { if (iErr) console.warn('Failed to insert new refresh token', iErr); });
        const secureFlag = (process.env.NODE_ENV === 'production');
        res.cookie('accessToken', newAccess, { httpOnly: true, sameSite: 'lax', secure: secureFlag, maxAge: 15 * 60 * 1000 });
        res.cookie('refreshToken', newRefresh, { httpOnly: true, sameSite: 'lax', secure: secureFlag, maxAge: 7 * 24 * 60 * 60 * 1000 });
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
  res.clearCookie('accessToken');
  res.clearCookie('refreshToken');
  res.json({ success: true });
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
