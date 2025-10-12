// Entry point for the backend server
const express = require('express');
// use express.json() instead of body-parser
const cors = require('cors');
const compression = require('compression');
const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');

const app = express();
// Port configuration: Render sets PORT=10000, local development defaults to 3001
const PORT = process.env.PORT || 3001;
const SECRET = process.env.JWT_SECRET || 'your_jwt_secret'; // Override via JWT_SECRET in production

// Enable CORS for credentialed cross-origin requests.
// Echo the request Origin so previews and different subdomains are accepted.
// Allow Authorization header for Bearer token flows and Content-Type for JSON.
// Gzip/Brotli compression for responses (reduces bandwidth)
app.use(compression());
app.use(cors({ origin: true, credentials: true, allowedHeaders: ['Content-Type', 'Authorization'] }));
app.use(express.json());

// Optional: serve the client static files from the same server for simple deployments.
// Set SERVE_CLIENT=false to disable when frontend is hosted separately.
const serveClient = (process.env.SERVE_CLIENT || 'true') === 'true';
if (serveClient) {
  const path = require('path');
  const clientDir = path.join(__dirname, '..', 'client');
  try {
    // Serve static assets with conservative caching. index.html is always no-cache
    app.use(express.static(clientDir, {
      // default maxAge for static files (overridden in setHeaders for specific files)
      maxAge: '1d',
      setHeaders: (res, filePath) => {
        if (filePath.endsWith('index.html')) {
          // Always fetch latest html so SPA updates are visible immediately
          res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
        } else if (/\.(js|css)$/.test(filePath)) {
          // Short caching for JS/CSS since we don't fingerprint files here
          res.setHeader('Cache-Control', 'public, max-age=86400'); // 1 day
        } else if (/\.(png|jpg|jpeg|svg|gif|webp)$/.test(filePath)) {
          res.setHeader('Cache-Control', 'public, max-age=604800'); // 7 days
        }
      }
    }));

    // SPA fallback: serve index.html for non-api routes
    app.get('*', (req, res, next) => {
      if (req.path.startsWith('/api')) return next();
      res.sendFile(path.join(clientDir, 'index.html'));
    });
    console.log('Serving client static files from', clientDir);
  } catch (e) { console.warn('Failed to enable static client serving', e); }
}

// Note: client is served separately in production (no static mounting here)

// Initialize Database
const path = require('path');
const dbPath = path.resolve(__dirname, 'database.sqlite');
const db = new sqlite3.Database(dbPath);
console.log(`Connected to SQLite database at ${dbPath}`);

// Initialize tables
db.serialize(() => {
  db.run(`CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT UNIQUE NOT NULL,
  password TEXT NOT NULL,
  nickname TEXT UNIQUE,
  discord_name TEXT
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
    FOREIGN KEY(user_id) REFERENCES users(id)

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
  db.run(`CREATE TABLE IF NOT EXISTS notifications (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    actor_user_id INTEGER,
    type TEXT,
    payload TEXT,
    read INTEGER DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY(user_id) REFERENCES users(id)
  )`);
  // Tribe system: tribes, memberships, shared tribe creature vault, join requests
  db.run(`CREATE TABLE IF NOT EXISTS tribes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    main_map TEXT,
    description TEXT,
    owner_user_id INTEGER NOT NULL,
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY(owner_user_id) REFERENCES users(id)
  )`);
  db.run(`CREATE TABLE IF NOT EXISTS tribe_memberships (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    tribe_id INTEGER NOT NULL,
    user_id INTEGER NOT NULL,
    role TEXT DEFAULT 'member', -- owner, admin, member
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY(tribe_id) REFERENCES tribes(id),
    FOREIGN KEY(user_id) REFERENCES users(id)
  )`);
  db.run(`CREATE TABLE IF NOT EXISTS tribe_creatures (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    tribe_id INTEGER NOT NULL,
    created_by_user_id INTEGER NOT NULL,
    data TEXT NOT NULL,
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY(tribe_id) REFERENCES tribes(id),
    FOREIGN KEY(created_by_user_id) REFERENCES users(id)
  )`);
  db.run(`CREATE TABLE IF NOT EXISTS tribe_join_requests (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    tribe_id INTEGER NOT NULL,
    user_id INTEGER NOT NULL,
    message TEXT,
    status TEXT DEFAULT 'pending', -- pending, accepted, rejected
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY(tribe_id) REFERENCES tribes(id),
    FOREIGN KEY(user_id) REFERENCES users(id)
  )`);
  // Boss invites and timers (planner)
  db.run(`CREATE TABLE IF NOT EXISTS boss_invites (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    boss_id TEXT NOT NULL,
    inviter_user_id INTEGER NOT NULL,
    invited_user_id INTEGER NOT NULL,
    message TEXT,
    status TEXT DEFAULT 'pending',
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY(inviter_user_id) REFERENCES users(id),
    FOREIGN KEY(invited_user_id) REFERENCES users(id)
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS boss_timers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    boss_id TEXT NOT NULL,
    scheduled_at TEXT NOT NULL,
    created_by_user_id INTEGER NOT NULL,
    status TEXT DEFAULT 'scheduled',
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY(created_by_user_id) REFERENCES users(id)
  )`);

  // Announcements (global events like Diamond Prized)
  db.run(`CREATE TABLE IF NOT EXISTS announcements (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    type TEXT NOT NULL,
    payload TEXT NOT NULL,
    created_by INTEGER,
    created_at TEXT DEFAULT (datetime('now'))
  )`);

  // Per-user boss planner saved data (JSON blob)
  db.run(`CREATE TABLE IF NOT EXISTS boss_planner (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    data TEXT NOT NULL,
    updated_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY(user_id) REFERENCES users(id)
  )`);

  // Per-user arena creature lists (stored as JSON mapping arenaId -> [creature objects])
  db.run(`CREATE TABLE IF NOT EXISTS arena_collections (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    data TEXT NOT NULL,
    updated_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY(user_id) REFERENCES users(id)
  )`);

  // Friends system table
  db.run(`CREATE TABLE IF NOT EXISTS friends (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    friend_user_id INTEGER NOT NULL,
    status TEXT DEFAULT 'pending', -- pending, accepted, blocked
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY(user_id) REFERENCES users(id),
    FOREIGN KEY(friend_user_id) REFERENCES users(id),
    UNIQUE(user_id, friend_user_id)
  )`);

  // Ensure nickname column exists for older databases (safe check)
  db.all("PRAGMA table_info(users)", (err, cols) => {
    if (err || !Array.isArray(cols)) return;
    const hasNickname = cols.some(c => c.name === 'nickname');
    const hasDiscordName = cols.some(c => c.name === 'discord_name');
    
    if (!hasNickname) {
      db.run('ALTER TABLE users ADD COLUMN nickname TEXT UNIQUE', (aerr) => {
        if (aerr) console.warn('Failed to add nickname column:', aerr.message || aerr);
      });
    }
    
    if (!hasDiscordName) {
      db.run('ALTER TABLE users ADD COLUMN discord_name TEXT', (aerr) => {
        if (aerr) console.warn('Failed to add discord_name column:', aerr.message || aerr);
        else console.log('Added discord_name column to users table');
      });
    }
  });
});

// Register endpoint
app.post('/api/register', (req, res) => {
  console.log('[API] /api/register endpoint hit with method:', req.method);
  // Log incoming request for diagnostics (helps detect proxies or body-parsing issues)
  try { console.log('[API] /api/register incoming', { headers: req.headers || {}, bodyPreview: (() => { try { return JSON.stringify(req.body).slice(0,200); } catch(e){ return String(req.body); } })() }); } catch(e){}
  const { email, password, nickname, discord_name } = req.body || {};
  console.log('[API] /api/register extracted fields:', { email: !!email, password: !!password, nickname: !!nickname, discord_name: !!discord_name });
  
  // Validate required fields
  if (!email || !password) {
    res.setHeader('Content-Type', 'application/json');
    return res.status(400).json({ error: 'Missing email or password' });
  }

  // Clean input values
  const emailVal = (email || '').trim();
  const nickVal = nickname ? String(nickname).trim() : null;
  const discordVal = discord_name ? String(discord_name).trim() : null;

  // Basic validation
  if (!emailVal.includes('@')) {
    res.setHeader('Content-Type', 'application/json');
    return res.status(400).json({ error: 'Invalid email format' });
  }

  // Check for existing email or nickname (case-insensitive)
  const checkQuery = nickVal 
    ? 'SELECT id FROM users WHERE email = ? COLLATE NOCASE OR (nickname IS NOT NULL AND nickname = ? COLLATE NOCASE)'
    : 'SELECT id FROM users WHERE email = ? COLLATE NOCASE';
  const checkParams = nickVal ? [emailVal, nickVal] : [emailVal];

  db.get(checkQuery, checkParams, (err, row) => {
    if (err) {
      console.warn('[API] /api/register db lookup error', err && err.message ? err.message : err);
      res.setHeader('Content-Type', 'application/json');
      return res.status(500).json({ error: 'Server error during lookup' });
    }
    if (row) {
      res.setHeader('Content-Type', 'application/json');
      return res.status(400).json({ error: 'Email or nickname already exists' });
    }

    // Hash password and create user
    bcrypt.hash(password, 10, (err, hash) => {
      if (err) {
        console.warn('[API] /api/register bcrypt error', err && err.message ? err.message : err);
        res.setHeader('Content-Type', 'application/json');
        return res.status(500).json({ error: 'Server error during password processing' });
      }

      // Insert new user with all fields
      db.run(
        'INSERT INTO users (email, password, nickname, discord_name) VALUES (?, ?, ?, ?)', 
        [emailVal, hash, nickVal, discordVal], 
        function(err) {
          console.log('[API] /api/register db.run callback triggered');
          if (err) {
            console.warn('[API] /api/register insert error', err && err.message ? err.message : err);
            res.setHeader('Content-Type', 'application/json');
            return res.status(500).json({ error: 'Failed to create user' });
          }

          // Generate token and return user info
          const userId = this.lastID;
          console.log('[API] /api/register got userId from db:', userId);
          const token = jwt.sign({ userId }, SECRET, { expiresIn: '1d' });
          console.log('[API] /api/register generated token:', token ? 'YES' : 'NO');
          
          const responseData = { 
            success: true, 
            token, 
            userId,
            email: emailVal,
            nickname: nickVal,
            discord_name: discordVal
          };
          
          console.log('[API] /api/register about to send response:', JSON.stringify(responseData));
          res.setHeader('Content-Type', 'application/json');
          res.status(200);
          res.json(responseData);
          console.log('[API] /api/register response sent');
          return;
        }
      );
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
    res.setHeader('Content-Type', 'application/json');
    return res.json({ token, user: { id: user.id, email: user.email, nickname: user.nickname } });
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
  const payloadStr = JSON.stringify(data || {});
  db.run('INSERT INTO creature_cards (user_id, data) VALUES (?, ?)', [req.user.userId, payloadStr], function(err) {
    if (err) return res.status(500).json({ error: 'Failed to save' });
    const newId = this.lastID;
    // If creature has achievements and any is prized diamond, create announcement and notifications
    try {
      const achievements = (data && data.achievements) || [];
      const hasDiamond = achievements.some(a => (a.id === 'prized_bloodline' && a.tier === 'diamond') || (a.id === 'prized_bloodline' && a.meta && a.meta.announce));
      if (hasDiamond) {
        const annPayload = JSON.stringify({ creatureId: newId, userId: req.user.userId, creatureName: (data && data.name) || null });
        db.run('INSERT INTO announcements (type, payload, created_by) VALUES (?, ?, ?)', ['diamond_prized', annPayload, req.user.userId], function(err) {
          if (!err) {
            const annId = this.lastID;
            // notify all users (simple approach); in future restrict to followers/tribe
            db.all('SELECT id FROM users', [], (err, rows) => {
              if (!err && Array.isArray(rows)) {
                const stmt = db.prepare('INSERT INTO notifications (user_id, actor_user_id, type, payload, read) VALUES (?, ?, ?, ?, 0)');
                rows.forEach(r => {
                  try { stmt.run(r.id, req.user.userId, 'announcement', annPayload); } catch (e) {}
                });
                try { stmt.finalize(); } catch (e){}
              }
            });
          }
        });
      }
    } catch (e) { /* ignore announcement errors */ }

    res.setHeader('Content-Type', 'application/json');
    return res.status(201).json({ success: true, id: newId });
  });
});

// Update existing creature (only if owned by user)
app.put('/api/creature/:id', authenticateToken, (req, res) => {
  const id = req.params.id;
  const { data } = req.body;
  const payloadStr = JSON.stringify(data || {});
  db.run('UPDATE creature_cards SET data = ? WHERE id = ? AND user_id = ?', [payloadStr, id, req.user.userId], function(err) {
    if (err) return res.status(500).json({ error: 'Failed to update' });
    if (this.changes === 0) return res.status(404).json({ error: 'Not found or not owned' });
    // announcement on update as well
    try {
      const achievements = (data && data.achievements) || [];
      const hasDiamond = achievements.some(a => (a.id === 'prized_bloodline' && a.tier === 'diamond') || (a.id === 'prized_bloodline' && a.meta && a.meta.announce));
      if (hasDiamond) {
        const annPayload = JSON.stringify({ creatureId: id, userId: req.user.userId, creatureName: (data && data.name) || null });
        db.run('INSERT INTO announcements (type, payload, created_by) VALUES (?, ?, ?)', ['diamond_prized', annPayload, req.user.userId], function(err) {
          if (!err) {
            db.all('SELECT id FROM users', [], (err, rows) => {
              if (!err && Array.isArray(rows)) {
                const stmt = db.prepare('INSERT INTO notifications (user_id, actor_user_id, type, payload, read) VALUES (?, ?, ?, ?, 0)');
                rows.forEach(r => {
                  try { stmt.run(r.id, req.user.userId, 'announcement', annPayload); } catch (e) {}
                });
                try { stmt.finalize(); } catch (e){}
              }
            });
          }
        });
      }
    } catch (e) { }
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
    if (err) {
      console.error('Database error:', err);
      return res.status(500).json({ error: 'Failed to load' });
    }
    try {
      const parsedRows = rows.map(row => ({ id: row.id, ...JSON.parse(row.data) }));
      console.log('Fetched creature cards:', parsedRows);
      res.json(parsedRows);
    } catch (parseError) {
      console.error('JSON parse error:', parseError);
      return res.status(500).json({ error: 'Failed to parse creature data' });
    }
  });
});

// Marketplace: create a trade listing
app.post('/api/trades', authenticateToken, (req, res) => {
  const { creature_card_id, creature_data, wanted, price } = req.body || {};
  if (!creature_data) return res.status(400).json({ error: 'Missing creature data' });
  db.run('INSERT INTO trades (user_id, creature_card_id, creature_data, wanted, price, status) VALUES (?, ?, ?, ?, ?, ?)',
    [req.user.userId, creature_card_id || null, JSON.stringify(creature_data), wanted || null, price || null, 'open'], function(err) {
      if (err) return res.status(500).json({ error: 'Failed to create trade' });
    res.setHeader('Content-Type', 'application/json');
    return res.status(201).json({ success: true, id: this.lastID });
    });
});

// Marketplace: list/search trades (public)
app.get('/api/trades', (req, res) => {
  // Support simple query params: species, minPrice, maxPrice, status, stat, statMin, statMax
  const { species, minPrice, maxPrice, status, stat, statMin, statMax } = req.query || {};
  db.all('SELECT id, user_id, creature_card_id, creature_data, wanted, price, status, created_at FROM trades', [], (err, rows) => {
    if (err) return res.status(500).json({ error: 'Failed to load trades' });
    try {
      let items = rows.map(r => ({ id: r.id, user_id: r.user_id, creature_card_id: r.creature_card_id, creature: JSON.parse(r.creature_data), wanted: r.wanted, price: r.price, status: r.status, created_at: r.created_at }));
      if (species) items = items.filter(i => (i.creature && i.creature.species && i.creature.species.toLowerCase().includes(species.toLowerCase())));
      if (status) items = items.filter(i => (i.status || '').toLowerCase() === (status+'').toLowerCase());
      if (minPrice) items = items.filter(i => Number(i.price || 0) >= Number(minPrice));
      if (maxPrice) items = items.filter(i => Number(i.price || 0) <= Number(maxPrice));
      // stat-range filtering: expects stat name matching keys inside creature.baseStats (e.g., Health, Melee, Stamina)
      if (stat) {
        items = items.filter(i => {
          try {
            const v = Number(i.creature && i.creature.baseStats ? (i.creature.baseStats[stat] || 0) : 0);
            if (statMin && v < Number(statMin)) return false;
            if (statMax && v > Number(statMax)) return false;
            return true;
          } catch (e) { return false; }
        });
      }
    res.setHeader('Content-Type', 'application/json');
    return res.json(items);
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
        const offerId = this.lastID;
        // create notification for trade owner
        try {
          const payload = JSON.stringify({ offerId, tradeId, fromUserId: req.user.userId, message: message || null });
          db.run('INSERT INTO notifications (user_id, actor_user_id, type, payload, read) VALUES (?, ?, ?, ?, ?)', [trade.user_id, req.user.userId, 'offer', payload, 0]);
        } catch (e) { /* ignore notif failures */ }
        res.status(201).json({ success: true, id: offerId });
      });
  });
});

// Offers: list offers for a trade (owner sees all, others see only their offers)
app.get('/api/trades/:id/offers', authenticateToken, (req, res) => {
  const tradeId = req.params.id;
  db.all('SELECT offers.id, offers.trade_id, offers.from_user_id, offers.to_user_id, offers.offered_creature_id, offers.offered_creature_data, offers.offered_price, offers.message, offers.status, offers.created_at, u.nickname AS from_nickname FROM offers LEFT JOIN users u ON offers.from_user_id = u.id WHERE offers.trade_id = ?', [tradeId], (err, rows) => {
    if (err) return res.status(500).json({ error: 'Failed to load offers' });
    const parsed = rows.map(r => ({ id: r.id, trade_id: r.trade_id, from_user_id: r.from_user_id, from_nickname: r.from_nickname || null, to_user_id: r.to_user_id, offered_creature_id: r.offered_creature_id, offered_creature_data: JSON.parse(r.offered_creature_data || '{}'), offered_price: r.offered_price, message: r.message, status: r.status, created_at: r.created_at }));
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

// --- Profile endpoints ---
// Get user profile with extended information
app.get('/api/profile', authenticateToken, (req, res) => {
  const userId = req.user.userId;
  
  // Get user info
  db.get('SELECT id, email, nickname, discord_name FROM users WHERE id = ?', [userId], (err, user) => {
    if (err) return res.status(500).json({ error: 'Failed to fetch profile' });
    if (!user) return res.status(404).json({ error: 'User not found' });
    
    // Get tribe membership info
    db.get(`
      SELECT t.name as tribe_name, tm.role as tribe_role, t.id as tribe_id
      FROM tribe_memberships tm 
      JOIN tribes t ON tm.tribe_id = t.id 
      WHERE tm.user_id = ?
    `, [userId], (tribeErr, tribeInfo) => {
      if (tribeErr) console.warn('Failed to fetch tribe info:', tribeErr);
      
      // Get creature count
      db.get('SELECT COUNT(*) as creature_count FROM creature_cards WHERE user_id = ?', [userId], (creatureErr, creatureCount) => {
        if (creatureErr) console.warn('Failed to fetch creature count:', creatureErr);
        
        // Get friend count
        db.get(`
          SELECT COUNT(*) as friend_count 
          FROM friends 
          WHERE (user_id = ? OR friend_user_id = ?) AND status = 'accepted'
        `, [userId, userId], (friendErr, friendCount) => {
          if (friendErr) console.warn('Failed to fetch friend count:', friendErr);
          
          res.json({
            id: user.id,
            email: user.email,
            nickname: user.nickname,
            discord_name: user.discord_name,
            tribe: tribeInfo ? {
              name: tribeInfo.tribe_name,
              role: tribeInfo.tribe_role,
              id: tribeInfo.tribe_id
            } : null,
            creature_count: creatureCount ? creatureCount.creature_count : 0,
            friend_count: friendCount ? friendCount.friend_count : 0
          });
        });
      });
    });
  });
});

// Update user profile
app.put('/api/profile', authenticateToken, (req, res) => {
  const userId = req.user.userId;
  const { discord_name } = req.body || {};
  
  // For now, only allow updating discord_name (email/nickname changes would need more validation)
  db.run('UPDATE users SET discord_name = ? WHERE id = ?', [discord_name || null, userId], (err) => {
    if (err) return res.status(500).json({ error: 'Failed to update profile' });
    res.json({ success: true });
  });
});

// Get user's recent creatures (for quick access)
app.get('/api/profile/creatures', authenticateToken, (req, res) => {
  const userId = req.user.userId;
  const limit = parseInt(req.query.limit) || 5;
  
  db.all(`
    SELECT id, data, created_at 
    FROM creature_cards 
    WHERE user_id = ? 
    ORDER BY created_at DESC 
    LIMIT ?
  `, [userId, limit], (err, creatures) => {
    if (err) return res.status(500).json({ error: 'Failed to fetch creatures' });
    
    // Parse creature data
    const parsed = creatures.map(c => {
      try {
        const data = JSON.parse(c.data);
        return {
          id: c.id,
          name: data.name || 'Unnamed',
          species: data.species || 'Unknown',
          level: data.level || 1,
          created_at: c.created_at
        };
      } catch (e) {
        return {
          id: c.id,
          name: 'Invalid Data',
          species: 'Unknown',
          level: 1,
          created_at: c.created_at
        };
      }
    });
    
    res.json(parsed);
  });
});

// --- Friends System API Endpoints ---

// Send friend request
app.post('/api/friends/request', authenticateToken, (req, res) => {
  const userId = req.user.userId;
  const { friend_user_id } = req.body;
  
  if (!friend_user_id || friend_user_id == userId) {
    return res.status(400).json({ error: 'Invalid friend user ID' });
  }

  // Check if friendship already exists
  db.get(`
    SELECT * FROM friends 
    WHERE (user_id = ? AND friend_user_id = ?) 
       OR (user_id = ? AND friend_user_id = ?)
  `, [userId, friend_user_id, friend_user_id, userId], (err, existing) => {
    if (err) return res.status(500).json({ error: 'Database error' });
    if (existing) return res.status(400).json({ error: 'Friend relationship already exists' });

    // Create friend request
    db.run(`
      INSERT INTO friends (user_id, friend_user_id, status) 
      VALUES (?, ?, 'pending')
    `, [userId, friend_user_id], function(err) {
      if (err) return res.status(500).json({ error: 'Failed to send friend request' });
      res.json({ success: true, id: this.lastID });
    });
  });
});

// Get friends list
app.get('/api/friends', authenticateToken, (req, res) => {
  const userId = req.user.userId;
  const status = req.query.status || 'accepted'; // accepted, pending, all

  let statusCondition = '';
  if (status === 'pending') {
    statusCondition = `AND f.status = 'pending' AND f.friend_user_id = ${userId}`;
  } else if (status === 'accepted') {
    statusCondition = `AND f.status = 'accepted'`;
  }

  db.all(`
    SELECT 
      f.id,
      f.status,
      f.created_at,
      u.id as friend_id,
      u.email as friend_email,
      u.nickname as friend_nickname,
      u.discord_name as friend_discord_name
    FROM friends f
    JOIN users u ON (
      CASE 
        WHEN f.user_id = ? THEN u.id = f.friend_user_id
        ELSE u.id = f.user_id
      END
    )
    WHERE (f.user_id = ? OR f.friend_user_id = ?) ${statusCondition}
    ORDER BY f.updated_at DESC
  `, [userId, userId, userId], (err, friends) => {
    if (err) return res.status(500).json({ error: 'Failed to fetch friends' });
    res.json(friends || []);
  });
});

// Accept/reject friend request
app.put('/api/friends/:id', authenticateToken, (req, res) => {
  const userId = req.user.userId;
  const friendshipId = req.params.id;
  const { action } = req.body; // 'accept' or 'reject'

  if (!['accept', 'reject'].includes(action)) {
    return res.status(400).json({ error: 'Invalid action' });
  }

  // Verify this is a pending request to the current user
  db.get(`
    SELECT * FROM friends 
    WHERE id = ? AND friend_user_id = ? AND status = 'pending'
  `, [friendshipId, userId], (err, friendship) => {
    if (err) return res.status(500).json({ error: 'Database error' });
    if (!friendship) return res.status(404).json({ error: 'Friend request not found' });

    if (action === 'accept') {
      db.run(`
        UPDATE friends 
        SET status = 'accepted', updated_at = datetime('now') 
        WHERE id = ?
      `, [friendshipId], (err) => {
        if (err) return res.status(500).json({ error: 'Failed to accept friend request' });
        res.json({ success: true });
      });
    } else {
      db.run('DELETE FROM friends WHERE id = ?', [friendshipId], (err) => {
        if (err) return res.status(500).json({ error: 'Failed to reject friend request' });
        res.json({ success: true });
      });
    }
  });
});

// Remove friend
app.delete('/api/friends/:id', authenticateToken, (req, res) => {
  const userId = req.user.userId;
  const friendshipId = req.params.id;

  db.run(`
    DELETE FROM friends 
    WHERE id = ? AND (user_id = ? OR friend_user_id = ?)
  `, [friendshipId, userId, userId], function(err) {
    if (err) return res.status(500).json({ error: 'Failed to remove friend' });
    if (this.changes === 0) return res.status(404).json({ error: 'Friendship not found' });
    res.json({ success: true });
  });
});

// Enhanced user search with friend status
app.get('/api/users/search', authenticateToken, (req, res) => {
  const userId = req.user.userId;
  const q = (req.query.q || '').trim();
  if (!q) return res.json([]);
  
  const like = `%${q}%`;
  db.all(`
    SELECT 
      u.id, 
      u.email, 
      u.nickname, 
      u.discord_name,
      f.status as friend_status
    FROM users u
    LEFT JOIN friends f ON (
      (f.user_id = ? AND f.friend_user_id = u.id) OR 
      (f.friend_user_id = ? AND f.user_id = u.id)
    )
    WHERE (u.email LIKE ? COLLATE NOCASE OR u.nickname LIKE ? COLLATE NOCASE)
    AND u.id != ?
    ORDER BY u.nickname ASC, u.email ASC
    LIMIT 50
  `, [userId, userId, like, like, userId], (err, rows) => {
    if (err) return res.status(500).json({ error: 'User search failed' });
    res.json(rows || []);
  });
});

// --- Tribe endpoints ---
// Create a tribe
app.post('/api/tribes', authenticateToken, (req, res) => {
  const { name, main_map, description } = req.body || {};
  if (!name) return res.status(400).json({ error: 'Missing tribe name' });
  db.run('INSERT INTO tribes (name, main_map, description, owner_user_id) VALUES (?, ?, ?, ?)', [name, main_map || null, description || null, req.user.userId], function(err) {
    if (err) return res.status(500).json({ error: 'Failed to create tribe' });
    const tribeId = this.lastID;
    // Create membership as owner
    db.run('INSERT INTO tribe_memberships (tribe_id, user_id, role) VALUES (?, ?, ?)', [tribeId, req.user.userId, 'owner']);
    res.status(201).json({ success: true, id: tribeId });
  });
});

// List tribes (public search)
app.get('/api/tribes', (req, res) => {
  const q = (req.query.q || '').trim();
  db.all('SELECT id, name, main_map, description, owner_user_id, created_at FROM tribes', [], (err, rows) => {
    if (err) return res.status(500).json({ error: 'Failed to load tribes' });
    let items = rows || [];
    if (q) items = items.filter(t => (t.name || '').toLowerCase().includes(q.toLowerCase()) || (t.description || '').toLowerCase().includes(q.toLowerCase()));
    res.json(items);
  });
});

// Get tribe details including members (requires auth to see member roles)
app.get('/api/tribes/:id', authenticateToken, (req, res) => {
  const id = req.params.id;
  db.get('SELECT id, name, main_map, description, owner_user_id, created_at FROM tribes WHERE id = ?', [id], (err, tribe) => {
    if (err || !tribe) return res.status(404).json({ error: 'Tribe not found' });
    db.all('SELECT m.id, m.user_id, m.role, u.nickname, u.email FROM tribe_memberships m LEFT JOIN users u ON m.user_id = u.id WHERE m.tribe_id = ?', [id], (err2, members) => {
      if (err2) return res.status(500).json({ error: 'Failed to load members' });
      res.json({ ...tribe, members: members || [] });
    });
  });
});

// Add a member to tribe (owner/admin only)
app.post('/api/tribes/:id/members', authenticateToken, (req, res) => {
  const tribeId = req.params.id;
  const { user_id, role } = req.body || {};
  if (!user_id) return res.status(400).json({ error: 'Missing user_id' });
  // Check caller role
  db.get('SELECT role FROM tribe_memberships WHERE tribe_id = ? AND user_id = ?', [tribeId, req.user.userId], (err, me) => {
    if (err || !me) return res.status(403).json({ error: 'Not a member' });
    if (!(me.role === 'owner' || me.role === 'admin')) return res.status(403).json({ error: 'Insufficient role' });
    // ensure not already member
    db.get('SELECT id FROM tribe_memberships WHERE tribe_id = ? AND user_id = ?', [tribeId, user_id], (err2, row) => {
      if (err2) return res.status(500).json({ error: 'Lookup failed' });
      if (row) return res.status(400).json({ error: 'Already a member' });
      db.run('INSERT INTO tribe_memberships (tribe_id, user_id, role) VALUES (?, ?, ?)', [tribeId, user_id, role || 'member'], function(err3) {
        if (err3) return res.status(500).json({ error: 'Failed to add member' });
        res.json({ success: true });
      });
    });
  });
});

// Remove a member (owner/admin cannot remove owner unless owner transfers ownership first)
app.delete('/api/tribes/:id/members/:userId', authenticateToken, (req, res) => {
  const tribeId = req.params.id;
  const targetUserId = req.params.userId;
  db.get('SELECT role FROM tribe_memberships WHERE tribe_id = ? AND user_id = ?', [tribeId, req.user.userId], (err, me) => {
    if (err || !me) return res.status(403).json({ error: 'Not a member' });
    if (!(me.role === 'owner' || me.role === 'admin')) return res.status(403).json({ error: 'Insufficient role' });
    // prevent removing owner
    db.get('SELECT role FROM tribe_memberships WHERE tribe_id = ? AND user_id = ?', [tribeId, targetUserId], (err2, target) => {
      if (err2 || !target) return res.status(404).json({ error: 'Target not a member' });
      if (target.role === 'owner') return res.status(400).json({ error: 'Cannot remove owner' });
      db.run('DELETE FROM tribe_memberships WHERE tribe_id = ? AND user_id = ?', [tribeId, targetUserId], function(err3) {
        if (err3) return res.status(500).json({ error: 'Failed to remove member' });
        res.json({ success: true });
      });
    });
  });
});

// Transfer ownership (only current owner)
app.post('/api/tribes/:id/transfer', authenticateToken, (req, res) => {
  const tribeId = req.params.id;
  const { new_owner_user_id } = req.body || {};
  if (!new_owner_user_id) return res.status(400).json({ error: 'Missing new owner id' });
  db.get('SELECT role FROM tribe_memberships WHERE tribe_id = ? AND user_id = ?', [tribeId, req.user.userId], (err, me) => {
    if (err || !me || me.role !== 'owner') return res.status(403).json({ error: 'Only owner can transfer' });
    // set previous owner's role to admin, and new owner role to owner
    db.run('UPDATE tribe_memberships SET role = ? WHERE tribe_id = ? AND user_id = ?', ['admin', tribeId, req.user.userId], function(err2) {
      if (err2) return res.status(500).json({ error: 'Failed to demote previous owner' });
      db.run('UPDATE tribe_memberships SET role = ? WHERE tribe_id = ? AND user_id = ?', ['owner', tribeId, new_owner_user_id], function(err3) {
        if (err3) return res.status(500).json({ error: 'Failed to promote new owner' });
        db.run('UPDATE tribes SET owner_user_id = ? WHERE id = ?', [new_owner_user_id, tribeId]);
        res.json({ success: true });
      });
    });
  });
});

// Request to join a tribe (creates a join request and notifies owners/admins)
app.post('/api/tribes/:id/join', authenticateToken, (req, res) => {
  const tribeId = req.params.id;
  const { message } = req.body || {};
  db.run('INSERT INTO tribe_join_requests (tribe_id, user_id, message, status) VALUES (?, ?, ?, ?)', [tribeId, req.user.userId, message || null, 'pending'], function(err) {
    if (err) return res.status(500).json({ error: 'Failed to create join request' });
    const reqId = this.lastID;
    // notify all owners/admins of tribe
    db.all('SELECT m.user_id FROM tribe_memberships m WHERE m.tribe_id = ? AND (m.role = ? OR m.role = ?)', [tribeId, 'owner', 'admin'], (err2, rows) => {
      try {
        (rows||[]).forEach(r => {
          const payload = JSON.stringify({ joinRequestId: reqId, tribeId, fromUserId: req.user.userId, message: message || null });
          db.run('INSERT INTO notifications (user_id, actor_user_id, type, payload, read) VALUES (?, ?, ?, ?, ?)', [r.user_id, req.user.userId, 'tribe_join_request', payload, 0]);
        });
      } catch (e) {}
    });
    res.json({ success: true, id: reqId });
  });
});

// Admins/Owners can respond to join requests
app.put('/api/tribes/join_requests/:id', authenticateToken, (req, res) => {
  const id = req.params.id;
  const { status, targetRole } = req.body || {};
  if (!status) return res.status(400).json({ error: 'Missing status' });
  db.get('SELECT * FROM tribe_join_requests WHERE id = ?', [id], (err, jr) => {
    if (err || !jr) return res.status(404).json({ error: 'Join request not found' });
    // check caller is admin/owner for that tribe
    db.get('SELECT role FROM tribe_memberships WHERE tribe_id = ? AND user_id = ?', [jr.tribe_id, req.user.userId], (err2, me) => {
      if (err2 || !me) return res.status(403).json({ error: 'Not a tribe admin' });
      if (!(me.role === 'owner' || me.role === 'admin')) return res.status(403).json({ error: 'Insufficient role' });
      db.run('UPDATE tribe_join_requests SET status = ? WHERE id = ?', [status, id], function(err3) {
        if (err3) return res.status(500).json({ error: 'Failed to update request' });
        if (status === 'accepted') {
          // add membership
          db.run('INSERT INTO tribe_memberships (tribe_id, user_id, role) VALUES (?, ?, ?)', [jr.tribe_id, jr.user_id, targetRole || 'member']);
        }
        // notify requester
        const payload = JSON.stringify({ joinRequestId: id, status });
        db.run('INSERT INTO notifications (user_id, actor_user_id, type, payload, read) VALUES (?, ?, ?, ?, ?)', [jr.user_id, req.user.userId, 'tribe_join_response', payload, 0]);
        res.json({ success: true });
      });
    });
  });
});

// --- Tribe creature vault endpoints ---
// Add a creature to tribe vault (member+ can add)
app.post('/api/tribes/:id/creatures', authenticateToken, (req, res) => {
  const tribeId = req.params.id;
  const { data } = req.body || {};
  if (!data) return res.status(400).json({ error: 'Missing creature data' });
  // verify membership
  db.get('SELECT role FROM tribe_memberships WHERE tribe_id = ? AND user_id = ?', [tribeId, req.user.userId], (err, me) => {
    if (err || !me) return res.status(403).json({ error: 'Not a tribe member' });
    db.run('INSERT INTO tribe_creatures (tribe_id, created_by_user_id, data) VALUES (?, ?, ?)', [tribeId, req.user.userId, JSON.stringify(data)], function(err2) {
      if (err2) return res.status(500).json({ error: 'Failed to add creature' });
      res.status(201).json({ success: true, id: this.lastID });
    });
  });
});

// List tribe creatures
app.get('/api/tribes/:id/creatures', authenticateToken, (req, res) => {
  const tribeId = req.params.id;
  // verify membership
  db.get('SELECT id FROM tribe_memberships WHERE tribe_id = ? AND user_id = ?', [tribeId, req.user.userId], (err, me) => {
    if (err || !me) return res.status(403).json({ error: 'Not a tribe member' });
    db.all('SELECT id, created_by_user_id, data, created_at FROM tribe_creatures WHERE tribe_id = ?', [tribeId], (err2, rows) => {
      if (err2) return res.status(500).json({ error: 'Failed to load tribe creatures' });
      res.json((rows||[]).map(r => ({ id: r.id, created_by_user_id: r.created_by_user_id, ...JSON.parse(r.data || '{}'), created_at: r.created_at })));
    });
  });
});

// Notifications: list notifications for authenticated user
app.get('/api/notifications', authenticateToken, (req, res) => {
  db.all('SELECT id, actor_user_id, type, payload, read, created_at FROM notifications WHERE user_id = ? ORDER BY created_at DESC', [req.user.userId], (err, rows) => {
    if (err) return res.status(500).json({ error: 'Failed to load notifications' });
    try {
      const items = (rows || []).map(r => ({ id: r.id, actor_user_id: r.actor_user_id, type: r.type, payload: (r.payload ? JSON.parse(r.payload) : {}), read: !!r.read, created_at: r.created_at }));
      res.json(items);
    } catch (e) { res.status(500).json({ error: 'Failed to parse notifications' }); }
  });
});

// Mark a notification as read
app.put('/api/notifications/:id/read', authenticateToken, (req, res) => {
  const id = req.params.id;
  db.run('UPDATE notifications SET read = 1 WHERE id = ? AND user_id = ?', [id, req.user.userId], function(err) {
    if (err) return res.status(500).json({ error: 'Failed to mark read' });
    if (this.changes === 0) return res.status(404).json({ error: 'Notification not found or not owned' });
    res.json({ success: true });
  });
});

// --- Boss Planner endpoints: invites and timers ---
// Create an invite (inviter must be authenticated)
app.post('/api/boss/invites', authenticateToken, (req, res) => {
  const { bossId, invitedUserId, message } = req.body || {};
  if (!bossId || !invitedUserId) return res.status(400).json({ error: 'Missing fields' });
  db.run('INSERT INTO boss_invites (boss_id, inviter_user_id, invited_user_id, message) VALUES (?, ?, ?, ?)', [bossId, req.user.userId, invitedUserId, message || null], function(err) {
    if (err) return res.status(500).json({ error: 'Failed to create invite' });
    // create a notification for the invited user
    const payload = JSON.stringify({ bossId, inviteId: this.lastID, from: req.user.userId, message: message || '' });
    db.run('INSERT INTO notifications (user_id, actor_user_id, type, payload) VALUES (?, ?, ?, ?)', [invitedUserId, req.user.userId, 'boss_invite', payload]);
    res.status(201).json({ success: true, id: this.lastID });
  });
});

// List invites for a boss or for a user
app.get('/api/boss/invites', authenticateToken, (req, res) => {
  const bossId = req.query.bossId;
  if (bossId) {
    db.all('SELECT id, boss_id, inviter_user_id, invited_user_id, message, status, created_at FROM boss_invites WHERE boss_id = ?', [bossId], (err, rows) => {
      if (err) return res.status(500).json({ error: 'Failed to load invites' });
      res.json(rows || []);
    });
  } else {
    // return invites where the user is invited or invited others
    db.all('SELECT id, boss_id, inviter_user_id, invited_user_id, message, status, created_at FROM boss_invites WHERE invited_user_id = ? OR inviter_user_id = ? ORDER BY created_at DESC', [req.user.userId, req.user.userId], (err, rows) => {
      if (err) return res.status(500).json({ error: 'Failed to load invites' });
      res.json(rows || []);
    });
  }
});

// Update or cancel an invite (inviter or invited user)
app.put('/api/boss/invites/:id', authenticateToken, (req, res) => {
  const id = req.params.id;
  const { status } = req.body || {};
  if (!status) return res.status(400).json({ error: 'Missing status' });
  db.get('SELECT * FROM boss_invites WHERE id = ?', [id], (err, row) => {
    if (err || !row) return res.status(404).json({ error: 'Invite not found' });
    if (row.inviter_user_id !== req.user.userId && row.invited_user_id !== req.user.userId) return res.status(403).json({ error: 'Not authorized' });
    db.run('UPDATE boss_invites SET status = ? WHERE id = ?', [status, id], function(err2) {
      if (err2) return res.status(500).json({ error: 'Failed to update invite' });
      res.json({ success: true });
    });
  });
});

// Create a timer for a boss
app.post('/api/boss/timers', authenticateToken, (req, res) => {
  const { bossId, scheduledAt } = req.body || {};
  if (!bossId || !scheduledAt) return res.status(400).json({ error: 'Missing fields' });
  db.run('INSERT INTO boss_timers (boss_id, scheduled_at, created_by_user_id) VALUES (?, ?, ?)', [bossId, scheduledAt, req.user.userId], function(err) {
    if (err) return res.status(500).json({ error: 'Failed to create timer' });
    res.status(201).json({ success: true, id: this.lastID });
  });
});

// List timers (optional filter by bossId)
app.get('/api/boss/timers', authenticateToken, (req, res) => {
  const bossId = req.query.bossId;
  if (bossId) {
    db.all('SELECT id, boss_id, scheduled_at, created_by_user_id, status, created_at FROM boss_timers WHERE boss_id = ? ORDER BY scheduled_at ASC', [bossId], (err, rows) => {
      if (err) return res.status(500).json({ error: 'Failed to load timers' });
      res.json(rows || []);
    });
  } else {
    db.all('SELECT id, boss_id, scheduled_at, created_by_user_id, status, created_at FROM boss_timers WHERE created_by_user_id = ? OR status = ? ORDER BY scheduled_at ASC', [req.user.userId, 'scheduled'], (err, rows) => {
      if (err) return res.status(500).json({ error: 'Failed to load timers' });
      res.json(rows || []);
    });
  }
});

// Cancel a timer
app.put('/api/boss/timers/:id/cancel', authenticateToken, (req, res) => {
  const id = req.params.id;
  db.get('SELECT * FROM boss_timers WHERE id = ?', [id], (err, row) => {
    if (err || !row) return res.status(404).json({ error: 'Timer not found' });
    if (row.created_by_user_id !== req.user.userId) return res.status(403).json({ error: 'Not authorized' });
    db.run('UPDATE boss_timers SET status = ? WHERE id = ?', ['cancelled', id], function(err2) {
      if (err2) return res.status(500).json({ error: 'Failed to cancel timer' });
      res.json({ success: true });
    });
  });
});

// Get boss planner saved data for authenticated user
app.get('/api/boss/data', authenticateToken, (req, res) => {
  db.get('SELECT id, data, updated_at FROM boss_planner WHERE user_id = ? ORDER BY updated_at DESC LIMIT 1', [req.user.userId], (err, row) => {
    if (err) return res.status(500).json({ error: 'Failed to load boss data' });
    if (!row) return res.json({});
    try { return res.json({ id: row.id, data: JSON.parse(row.data || '{}'), updated_at: row.updated_at }); } catch (e) { return res.status(500).json({ error: 'Failed to parse boss data' }); }
  });
});

// Upsert boss planner data for authenticated user
app.put('/api/boss/data', authenticateToken, (req, res) => {
  const { data } = req.body || {};
  if (!data) return res.status(400).json({ error: 'Missing data' });
  const payload = JSON.stringify(data);
  // Try update first
  db.run('UPDATE boss_planner SET data = ?, updated_at = datetime(\'now\') WHERE user_id = ?', [payload, req.user.userId], function(err) {
    if (err) return res.status(500).json({ error: 'Failed to save' });
    if (this.changes && this.changes > 0) return res.json({ success: true });
    // else insert
    db.run('INSERT INTO boss_planner (user_id, data) VALUES (?, ?)', [req.user.userId, payload], function(err2) {
      if (err2) return res.status(500).json({ error: 'Failed to save' });
      res.json({ success: true });
    });
  });
});

// Get per-user arena creature collections
app.get('/api/arena/creatures', authenticateToken, (req, res) => {
  db.get('SELECT id, data, updated_at FROM arena_collections WHERE user_id = ? ORDER BY updated_at DESC LIMIT 1', [req.user.userId], (err, row) => {
    if (err) return res.status(500).json({ error: 'Failed to load arena collections' });
    if (!row) return res.json({});
    try { return res.json({ id: row.id, data: JSON.parse(row.data || '{}'), updated_at: row.updated_at }); } catch (e) { return res.status(500).json({ error: 'Failed to parse arena collections' }); }
  });
});

// Upsert per-user arena creature collections
app.put('/api/arena/creatures', authenticateToken, (req, res) => {
  const { data } = req.body || {};
  if (!data) return res.status(400).json({ error: 'Missing data' });
  const payload = JSON.stringify(data);
  db.run('UPDATE arena_collections SET data = ?, updated_at = datetime(\'now\') WHERE user_id = ?', [payload, req.user.userId], function(err) {
    if (err) return res.status(500).json({ error: 'Failed to save' });
    if (this.changes && this.changes > 0) return res.json({ success: true });
    db.run('INSERT INTO arena_collections (user_id, data) VALUES (?, ?)', [req.user.userId, payload], function(err2) {
      if (err2) return res.status(500).json({ error: 'Failed to save' });
      res.json({ success: true });
    });
  });
});

// Get per-user boss fight plans
app.get('/api/bosses', authenticateToken, (req, res) => {
  db.get('SELECT id, data, updated_at FROM boss_planner WHERE user_id = ? ORDER BY updated_at DESC LIMIT 1', [req.user.userId], (err, row) => {
    if (err) return res.status(500).json({ error: 'Failed to load boss data' });
    if (!row) return res.json([]);
    try { 
      const bossData = JSON.parse(row.data || '[]');
      return res.json(bossData); 
    } catch (e) { 
      return res.status(500).json({ error: 'Failed to parse boss data' }); 
    }
  });
});

// Save per-user boss fight plans
app.put('/api/bosses', authenticateToken, (req, res) => {
  const bosses = req.body;
  if (!Array.isArray(bosses)) return res.status(400).json({ error: 'Expected boss array' });
  const payload = JSON.stringify(bosses);
  db.run('UPDATE boss_planner SET data = ?, updated_at = datetime(\'now\') WHERE user_id = ?', [payload, req.user.userId], function(err) {
    if (err) return res.status(500).json({ error: 'Failed to save boss data' });
    if (this.changes && this.changes > 0) return res.json({ success: true });
    db.run('INSERT INTO boss_planner (user_id, data) VALUES (?, ?)', [req.user.userId, payload], function(err2) {
      if (err2) return res.status(500).json({ error: 'Failed to save boss data' });
      res.json({ success: true });
    });
  });
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  if (!process.env.JWT_SECRET) console.warn('Using default JWT secret; set JWT_SECRET in environment for production');
});

// Background job: poll boss_timers and fire notifications for due timers
setInterval(() => {
  try {
    // find timers that are scheduled and due (scheduled_at <= now)
    const now = new Date().toISOString();
    db.all("SELECT id, boss_id, scheduled_at, created_by_user_id FROM boss_timers WHERE status = 'scheduled' AND scheduled_at <= ?", [now], (err, rows) => {
      if (err || !rows || rows.length === 0) return;
      rows.forEach(timer => {
        // mark timer as fired
        db.run("UPDATE boss_timers SET status = 'fired' WHERE id = ?", [timer.id]);
        // fetch invites for this boss and notify invited users
        db.all('SELECT invited_user_id, inviter_user_id FROM boss_invites WHERE boss_id = ? AND status = ?', [timer.boss_id, 'pending'], (err2, invites) => {
          if (err2) return;
          (invites||[]).forEach(inv => {
            const payload = JSON.stringify({ bossId: timer.boss_id, timerId: timer.id, from: timer.created_by_user_id });
            db.run('INSERT INTO notifications (user_id, actor_user_id, type, payload) VALUES (?, ?, ?, ?)', [inv.invited_user_id, inv.inviter_user_id || timer.created_by_user_id, 'boss_timer_alert', payload]);
          });
        });
      });
    });
  } catch (e) { console.warn('Timer worker error', e); }
}, 15000);
