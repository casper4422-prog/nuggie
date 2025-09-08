// Entry point for the backend server
const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');

const app = express();
const PORT = 3001;
const SECRET = 'your_jwt_secret'; // Change this in production

// Enable CORS for credentialed cross-origin requests.
// Echo the request Origin so previews and different subdomains are accepted.
// Allow Authorization header for Bearer token flows and Content-Type for JSON.
app.use(cors({ origin: true, credentials: true, allowedHeaders: ['Content-Type', 'Authorization'] }));
app.use(bodyParser.json());

// Initialize SQLite DB
const db = new sqlite3.Database('database.sqlite', (err) => {
  if (err) throw err;
  console.log('Connected to SQLite database.');
});

db.serialize(() => {
  db.run(`CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    nickname TEXT UNIQUE
  )`);
  db.run(`CREATE TABLE IF NOT EXISTS creature_cards (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    data TEXT NOT NULL,
    FOREIGN KEY(user_id) REFERENCES users(id)
  )`);
  db.run(`CREATE TABLE IF NOT EXISTS trades (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    creature_card_id INTEGER,
    creature_data TEXT NOT NULL,
    wanted TEXT,
    price REAL,
    status TEXT DEFAULT 'open',
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY(user_id) REFERENCES users(id),
    FOREIGN KEY(creature_card_id) REFERENCES creature_cards(id)
  )`);
  // Ensure nickname column exists for older databases (safe check)
  db.all("PRAGMA table_info(users)", (err, cols) => {
    if (err || !Array.isArray(cols)) return;
    const hasNickname = cols.some(c => c.name === 'nickname');
    if (!hasNickname) {
      db.run('ALTER TABLE users ADD COLUMN nickname TEXT UNIQUE', (aerr) => {
        if (aerr) console.warn('Failed to add nickname column:', aerr.message || aerr);
      });
    }
  });
});

// Register endpoint
app.post('/api/register', (req, res) => {
  const { email, password, nickname } = req.body;
  if (!email || !password) return res.status(400).json({ error: 'Missing email or password' });
  const emailVal = (email || '').trim();
  const nickVal = nickname ? String(nickname).trim() : null;
  // Check for existing email or nickname (case-insensitive)
  db.get('SELECT id FROM users WHERE email = ? COLLATE NOCASE OR (nickname IS NOT NULL AND nickname = ? COLLATE NOCASE)', [emailVal, nickVal], (err, row) => {
    if (err) return res.status(500).json({ error: 'Server error' });
    if (row) return res.status(400).json({ error: 'Email or nickname already exists' });
    bcrypt.hash(password, 10, (err, hash) => {
      if (err) return res.status(500).json({ error: 'Server error' });
      db.run('INSERT INTO users (email, password, nickname) VALUES (?, ?, ?)', [emailVal, hash, nickVal], function(err) {
        if (err) return res.status(500).json({ error: 'Failed to create user' });
        // return token + user info
        const userId = this.lastID;
        const token = jwt.sign({ userId }, SECRET, { expiresIn: '1d' });
        return res.json({ success: true, token, user: { id: userId, email: emailVal, nickname: nickVal } });
      });
    });
  });
});

// Login endpoint
app.post('/api/login', (req, res) => {
  const { identifier, password } = req.body; // identifier can be email or nickname
  if (!identifier || !password) return res.status(400).json({ error: 'Missing credentials' });
  const ident = String(identifier).trim();
  db.get('SELECT * FROM users WHERE email = ? COLLATE NOCASE OR nickname = ? COLLATE NOCASE', [ident, ident], (err, user) => {
    if (err || !user) return res.status(400).json({ error: 'Invalid credentials' });
    bcrypt.compare(password, user.password, (err, result) => {
      if (result) {
        const token = jwt.sign({ userId: user.id }, SECRET, { expiresIn: '1d' });
        res.json({ token, user: { id: user.id, email: user.email, nickname: user.nickname } });
      } else {
        res.status(400).json({ error: 'Invalid credentials' });
      }
    });
  });
});

// Auth middleware
function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
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
    res.status(201).json({ success: true, id: this.lastID });
  });
});

// Update existing creature (only if owned by user)
app.put('/api/creature/:id', authenticateToken, (req, res) => {
  const id = req.params.id;
  const { data } = req.body;
  db.run('UPDATE creature_cards SET data = ? WHERE id = ? AND user_id = ?', [JSON.stringify(data), id, req.user.userId], function(err) {
    if (err) return res.status(500).json({ error: 'Failed to update' });
    if (this.changes === 0) return res.status(404).json({ error: 'Not found or not owned' });
    res.json({ success: true });
  });
});

// Delete creature
app.delete('/api/creature/:id', authenticateToken, (req, res) => {
  const id = req.params.id;
  db.run('DELETE FROM creature_cards WHERE id = ? AND user_id = ?', [id, req.user.userId], function(err) {
    if (err) return res.status(500).json({ error: 'Failed to delete' });
    if (this.changes === 0) return res.status(404).json({ error: 'Not found or not owned' });
    res.json({ success: true });
  });
});

// Get all creature cards for user
app.get('/api/creature', authenticateToken, (req, res) => {
  db.all('SELECT id, data FROM creature_cards WHERE user_id = ?', [req.user.userId], (err, rows) => {
    if (err) return res.status(500).json({ error: 'Failed to load' });
    res.json(rows.map(row => ({ id: row.id, ...JSON.parse(row.data) })));
  });
});

// Marketplace: create a trade listing
app.post('/api/trades', authenticateToken, (req, res) => {
  const { creature_card_id, creature_data, wanted, price } = req.body || {};
  if (!creature_data) return res.status(400).json({ error: 'Missing creature data' });
  db.run('INSERT INTO trades (user_id, creature_card_id, creature_data, wanted, price, status) VALUES (?, ?, ?, ?, ?, ?)',
    [req.user.userId, creature_card_id || null, JSON.stringify(creature_data), wanted || null, price || null, 'open'], function(err) {
      if (err) return res.status(500).json({ error: 'Failed to create trade' });
      res.status(201).json({ success: true, id: this.lastID });
    });
});

// Marketplace: list/search trades (public)
app.get('/api/trades', (req, res) => {
  // Support simple query params: species, minPrice, maxPrice, status
  const { species, minPrice, maxPrice, status } = req.query || {};
  db.all('SELECT id, user_id, creature_card_id, creature_data, wanted, price, status, created_at FROM trades', [], (err, rows) => {
    if (err) return res.status(500).json({ error: 'Failed to load trades' });
    try {
      let items = rows.map(r => ({ id: r.id, user_id: r.user_id, creature_card_id: r.creature_card_id, creature: JSON.parse(r.creature_data), wanted: r.wanted, price: r.price, status: r.status, created_at: r.created_at }));
      if (species) items = items.filter(i => (i.creature && i.creature.species && i.creature.species.toLowerCase().includes(species.toLowerCase())));
      if (status) items = items.filter(i => (i.status || '').toLowerCase() === (status+'').toLowerCase());
      if (minPrice) items = items.filter(i => Number(i.price || 0) >= Number(minPrice));
      if (maxPrice) items = items.filter(i => Number(i.price || 0) <= Number(maxPrice));
      res.json(items);
    } catch (e) { res.status(500).json({ error: 'Failed to parse trades' }); }
  });
});

// Marketplace: get a single trade
app.get('/api/trades/:id', (req, res) => {
  const id = req.params.id;
  db.get('SELECT id, user_id, creature_card_id, creature_data, wanted, price, status, created_at FROM trades WHERE id = ?', [id], (err, row) => {
    if (err) return res.status(500).json({ error: 'Failed to load trade' });
    if (!row) return res.status(404).json({ error: 'Not found' });
    try { res.json({ id: row.id, user_id: row.user_id, creature: JSON.parse(row.creature_data), wanted: row.wanted, price: row.price, status: row.status, created_at: row.created_at }); } catch (e) { res.status(500).json({ error: 'Failed to parse trade' }); }
  });
});

// Marketplace: delete a trade (owner only)
app.delete('/api/trades/:id', authenticateToken, (req, res) => {
  const id = req.params.id;
  db.run('DELETE FROM trades WHERE id = ? AND user_id = ?', [id, req.user.userId], function(err) {
    if (err) return res.status(500).json({ error: 'Failed to delete' });
    if (this.changes === 0) return res.status(404).json({ error: 'Not found or not owner' });
    res.json({ success: true });
  });
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
