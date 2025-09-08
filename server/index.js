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
  db.run(`CREATE TABLE IF NOT EXISTS offers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    trade_id INTEGER NOT NULL,
    from_user_id INTEGER NOT NULL,
    to_user_id INTEGER NOT NULL,
    offered_creature_id INTEGER,
    offered_creature_data TEXT,
    offered_price REAL,
    message TEXT,
    status TEXT DEFAULT 'pending',
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY(trade_id) REFERENCES trades(id),
    FOREIGN KEY(from_user_id) REFERENCES users(id),
    FOREIGN KEY(to_user_id) REFERENCES users(id)
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

// Offers: create an offer for a trade
app.post('/api/trades/:id/offers', authenticateToken, (req, res) => {
  const tradeId = req.params.id;
  const { offered_creature_id, offered_creature_data, offered_price, message } = req.body || {};
  // load trade to determine recipient
  db.get('SELECT id, user_id, status FROM trades WHERE id = ?', [tradeId], (err, trade) => {
    if (err || !trade) return res.status(404).json({ error: 'Trade not found' });
    if (trade.status !== 'open') return res.status(400).json({ error: 'Trade is not open' });
    db.run('INSERT INTO offers (trade_id, from_user_id, to_user_id, offered_creature_id, offered_creature_data, offered_price, message, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      [tradeId, req.user.userId, trade.user_id, offered_creature_id || null, JSON.stringify(offered_creature_data || {}), offered_price || null, message || null, 'pending'], function(err) {
        if (err) return res.status(500).json({ error: 'Failed to create offer' });
        res.status(201).json({ success: true, id: this.lastID });
      });
  });
});

// Offers: list offers for a trade (owner sees all, others see only their offers)
app.get('/api/trades/:id/offers', authenticateToken, (req, res) => {
  const tradeId = req.params.id;
  db.all('SELECT id, trade_id, from_user_id, to_user_id, offered_creature_id, offered_creature_data, offered_price, message, status, created_at FROM offers WHERE trade_id = ?', [tradeId], (err, rows) => {
    if (err) return res.status(500).json({ error: 'Failed to load offers' });
    const parsed = rows.map(r => ({ id: r.id, trade_id: r.trade_id, from_user_id: r.from_user_id, to_user_id: r.to_user_id, offered_creature_id: r.offered_creature_id, offered_creature_data: JSON.parse(r.offered_creature_data || '{}'), offered_price: r.offered_price, message: r.message, status: r.status, created_at: r.created_at }));
    // If requester is trade owner, return all; otherwise filter to only their offers
    const filtered = parsed.filter(o => (req.user.userId === o.to_user_id) || (req.user.userId === o.from_user_id));
    res.json(filtered);
  });
});

// Offers: update an offer (accept/reject/cancel) - only allow owner of trade to accept/reject, offer maker can cancel
app.put('/api/offers/:id', authenticateToken, (req, res) => {
  const id = req.params.id;
  const { status } = req.body || {};
  if (!status) return res.status(400).json({ error: 'Missing status' });
  // load offer
  db.get('SELECT * FROM offers WHERE id = ?', [id], (err, offer) => {
    if (err || !offer) return res.status(404).json({ error: 'Offer not found' });
    // Accept: only trade owner (to_user_id) can accept
    if (status === 'accepted') {
      if (req.user.userId !== offer.to_user_id) return res.status(403).json({ error: 'Not authorized' });
      // mark offer accepted, transfer creature ownership if possible, then mark trade closed
      db.get('SELECT creature_card_id, creature_data FROM trades WHERE id = ?', [offer.trade_id], (err, tradeRow) => {
        if (err || !tradeRow) return res.status(500).json({ error: 'Trade lookup failed' });
        // Update offer status first
        db.run('UPDATE offers SET status = ? WHERE id = ?', ['accepted', id], function(err) {
          if (err) return res.status(500).json({ error: 'Failed to update offer' });
          // If the trade references an existing creature_card, transfer its ownership to the offer maker
          if (tradeRow.creature_card_id) {
            db.run('UPDATE creature_cards SET user_id = ? WHERE id = ?', [offer.from_user_id, tradeRow.creature_card_id], function(err) {
              if (err) return res.status(500).json({ error: 'Failed to transfer creature' });
              // close trade
              db.run('UPDATE trades SET status = ? WHERE id = ?', ['closed', offer.trade_id], function(err) {
                if (err) return res.status(500).json({ error: 'Failed to close trade' });
                return res.json({ success: true });
              });
            });
          } else {
            // No existing creature_card (listing was a snapshot). Create a new creature_card for the buyer using the stored creature_data
            const dataToInsert = tradeRow.creature_data || '{}';
            db.run('INSERT INTO creature_cards (user_id, data) VALUES (?, ?)', [offer.from_user_id, dataToInsert], function(err) {
              if (err) return res.status(500).json({ error: 'Failed to create creature for new owner' });
              // close trade
              db.run('UPDATE trades SET status = ? WHERE id = ?', ['closed', offer.trade_id], function(err) {
                if (err) return res.status(500).json({ error: 'Failed to close trade' });
                return res.json({ success: true });
              });
            });
          }
        });
      });
    } else if (status === 'rejected') {
      if (req.user.userId !== offer.to_user_id) return res.status(403).json({ error: 'Not authorized' });
      db.run('UPDATE offers SET status = ? WHERE id = ?', ['rejected', id], function(err) {
        if (err) return res.status(500).json({ error: 'Failed to update offer' });
        res.json({ success: true });
      });
    } else if (status === 'cancelled') {
      if (req.user.userId !== offer.from_user_id) return res.status(403).json({ error: 'Not authorized' });
      db.run('UPDATE offers SET status = ? WHERE id = ?', ['cancelled', id], function(err) {
        if (err) return res.status(500).json({ error: 'Failed to update offer' });
        res.json({ success: true });
      });
    } else {
      res.status(400).json({ error: 'Unsupported status' });
    }
  });
});

// Offers: list offers created by the authenticated user
app.get('/api/offers', authenticateToken, (req, res) => {
  db.all('SELECT id, trade_id, from_user_id, to_user_id, offered_creature_id, offered_creature_data, offered_price, message, status, created_at FROM offers WHERE from_user_id = ?', [req.user.userId], (err, rows) => {
    if (err) return res.status(500).json({ error: 'Failed to load offers' });
    res.json(rows.map(r => ({ id: r.id, trade_id: r.trade_id, offered_creature_id: r.offered_creature_id, offered_creature_data: JSON.parse(r.offered_creature_data || '{}'), offered_price: r.offered_price, message: r.message, status: r.status, created_at: r.created_at })));
  });
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
