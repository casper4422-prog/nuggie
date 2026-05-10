// Entry point for the backend server
const express = require('express');
const cors = require('cors');
const compression = require('compression');
const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const https = require('https');
const querystring = require('querystring');

const app = express();
// Port configuration: Render sets PORT=10000, local development defaults to 3001
const PORT = process.env.PORT || 3001;
const SECRET = process.env.JWT_SECRET || 'your_jwt_secret'; // Override via JWT_SECRET in production

// Enable CORS for credentialed cross-origin requests.
// Echo the request Origin so previews and different subdomains are accepted.
// Allow Authorization header for Bearer token flows and Content-Type for JSON.
// Gzip/Brotli compression for responses (reduces bandwidth)
// compression() removed — Render's CDN handles gzip at the edge; double-compressing
// causes the response body to arrive garbled/empty in the browser.
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
          // No caching for JS/CSS — we don't fingerprint files so must always fetch fresh
          res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
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
// Use Render's persistent disk in production so data survives service restarts.
// The disk is mounted at /opt/render/project/src/data per render.yaml.
const dbPath = process.env.RENDER_DISK_MOUNT_PATH
    ? path.join(process.env.RENDER_DISK_MOUNT_PATH, 'database.sqlite')
    : path.resolve(__dirname, 'database.sqlite');
const db = new sqlite3.Database(dbPath);
console.log(`Connected to SQLite database at ${dbPath}`);

// Initialize tables
db.serialize(() => {
  db.run(`CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT UNIQUE NOT NULL,
  password TEXT NOT NULL,
  nickname TEXT UNIQUE,
  discord_name TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
)`);
  // Add created_at to existing databases that pre-date this column
  db.run(`ALTER TABLE users ADD COLUMN created_at DATETIME DEFAULT CURRENT_TIMESTAMP`, () => {});
  // Enhanced profile fields
  db.run(`ALTER TABLE users ADD COLUMN bio TEXT`, () => {});
  db.run(`ALTER TABLE users ADD COLUMN banner_image TEXT`, () => {});
  db.run(`ALTER TABLE users ADD COLUMN looking_for TEXT`, () => {});
  db.run(`ALTER TABLE users ADD COLUMN pinned_creatures TEXT DEFAULT '[]'`, () => {});
  // Online status
  db.run(`ALTER TABLE users ADD COLUMN last_seen DATETIME`, () => {});
  // Discord OAuth
  db.run(`ALTER TABLE users ADD COLUMN discord_id TEXT UNIQUE`, () => {});
  db.run(`CREATE TABLE IF NOT EXISTS creature_cards (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    data TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(user_id) REFERENCES users(id)
  )`);
  db.run(`ALTER TABLE creature_cards ADD COLUMN created_at DATETIME DEFAULT CURRENT_TIMESTAMP`, () => {});
  // Tribe Alliances
  db.run(`CREATE TABLE IF NOT EXISTS tribe_alliances (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    tribe_id INTEGER NOT NULL,
    ally_tribe_id INTEGER NOT NULL,
    status TEXT DEFAULT 'pending',
    requested_by INTEGER NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(tribe_id, ally_tribe_id),
    FOREIGN KEY(tribe_id) REFERENCES tribes(id),
    FOREIGN KEY(ally_tribe_id) REFERENCES tribes(id)
  )`);
  db.run(`CREATE TABLE IF NOT EXISTS alliance_chat (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    alliance_id INTEGER NOT NULL,
    user_id INTEGER NOT NULL,
    message TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(alliance_id) REFERENCES tribe_alliances(id),
    FOREIGN KEY(user_id) REFERENCES users(id)
  )`);
  // Marketplace: Wishlists + Seller Ratings
  db.run(`CREATE TABLE IF NOT EXISTS wishlists (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    species TEXT NOT NULL,
    UNIQUE(user_id, species),
    FOREIGN KEY(user_id) REFERENCES users(id)
  )`);
  db.run(`CREATE TABLE IF NOT EXISTS trade_ratings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    rater_id INTEGER NOT NULL,
    rated_user_id INTEGER NOT NULL,
    trade_id INTEGER,
    rating INTEGER NOT NULL CHECK(rating BETWEEN 1 AND 5),
    comment TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(rater_id, trade_id),
    FOREIGN KEY(rater_id) REFERENCES users(id),
    FOREIGN KEY(rated_user_id) REFERENCES users(id)
  )`);
  // Reactions
  db.run(`CREATE TABLE IF NOT EXISTS reactions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    entity_type TEXT NOT NULL,
    entity_id INTEGER NOT NULL,
    emoji TEXT NOT NULL DEFAULT '❤️',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, entity_type, entity_id),
    FOREIGN KEY(user_id) REFERENCES users(id)
  )`);
  // Events / Calendar
  db.run(`CREATE TABLE IF NOT EXISTS events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    creator_id INTEGER NOT NULL,
    title TEXT NOT NULL,
    description TEXT,
    event_type TEXT DEFAULT 'general',
    map_name TEXT,
    scheduled_at DATETIME NOT NULL,
    max_attendees INTEGER,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(creator_id) REFERENCES users(id)
  )`);
  db.run(`CREATE TABLE IF NOT EXISTS event_rsvps (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    event_id INTEGER NOT NULL,
    user_id INTEGER NOT NULL,
    status TEXT DEFAULT 'going',
    UNIQUE(event_id, user_id),
    FOREIGN KEY(event_id) REFERENCES events(id),
    FOREIGN KEY(user_id) REFERENCES users(id)
  )`);
  // Direct Messages
  db.run(`CREATE TABLE IF NOT EXISTS direct_messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    from_user_id INTEGER NOT NULL,
    to_user_id INTEGER NOT NULL,
    message TEXT NOT NULL,
    read INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(from_user_id) REFERENCES users(id),
    FOREIGN KEY(to_user_id) REFERENCES users(id)
  )`);
  // Boss Fight Records
  db.run(`CREATE TABLE IF NOT EXISTS boss_fight_records (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    boss_name TEXT NOT NULL,
    map_name TEXT,
    difficulty TEXT,
    outcome TEXT NOT NULL DEFAULT 'success',
    notes TEXT,
    creatures_used TEXT DEFAULT '[]',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(user_id) REFERENCES users(id)
  )`);
  // Wild Find Reports
  db.run(`CREATE TABLE IF NOT EXISTS wild_finds (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    species TEXT NOT NULL,
    level INTEGER NOT NULL,
    map_name TEXT,
    coordinates TEXT,
    notes TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(user_id) REFERENCES users(id)
  )`);
  // Activity feed events table
  db.run(`CREATE TABLE IF NOT EXISTS activity_events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    type TEXT NOT NULL,
    data_json TEXT DEFAULT '{}',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
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
    flag_image TEXT,
    colors TEXT,
    owner_user_id INTEGER NOT NULL,
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY(owner_user_id) REFERENCES users(id)
  )`);
  // Add new columns to existing tribes tables
  db.run(`ALTER TABLE tribes ADD COLUMN flag_image TEXT`, () => {});
  db.run(`ALTER TABLE tribes ADD COLUMN colors TEXT`, () => {});
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

  // Per-user arena creature lists (legacy blob storage)
  db.run(`CREATE TABLE IF NOT EXISTS arena_collections (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    data TEXT NOT NULL,
    updated_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY(user_id) REFERENCES users(id)
  )`);

  // Arena collaborative sessions (boss fight war rooms)
  db.run(`CREATE TABLE IF NOT EXISTS arena_sessions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    boss_id TEXT NOT NULL,
    boss_name TEXT,
    creator_user_id INTEGER NOT NULL,
    join_code TEXT UNIQUE NOT NULL,
    difficulty TEXT DEFAULT 'alpha',
    status TEXT DEFAULT 'open',
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY(creator_user_id) REFERENCES users(id)
  )`);
  db.run(`CREATE TABLE IF NOT EXISTS arena_session_members (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id INTEGER NOT NULL,
    user_id INTEGER NOT NULL,
    joined_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY(session_id) REFERENCES arena_sessions(id),
    FOREIGN KEY(user_id) REFERENCES users(id)
  )`);
  db.run(`CREATE TABLE IF NOT EXISTS arena_creatures (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id INTEGER NOT NULL,
    user_id INTEGER NOT NULL,
    creature_data TEXT NOT NULL,
    added_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY(session_id) REFERENCES arena_sessions(id),
    FOREIGN KEY(user_id) REFERENCES users(id)
  )`);
  db.run(`CREATE TABLE IF NOT EXISTS arena_chat (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id INTEGER NOT NULL,
    user_id INTEGER NOT NULL,
    message_type TEXT DEFAULT 'text',
    content TEXT NOT NULL,
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY(session_id) REFERENCES arena_sessions(id),
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
          
          console.log('[API] /api/register sending response');
          return res.status(200).json(responseData);
        }
      );
    });
  });
});

// Login endpoint
app.post('/api/login', (req, res) => {
  console.log('[API] /api/login endpoint hit');
  const { identifier, password } = req.body; // identifier can be email or nickname
  if (!identifier || !password) {
    res.setHeader('Content-Type', 'application/json');
    return res.status(400).json({ error: 'Missing credentials' });
  }
  const ident = String(identifier).trim();
  console.log('[API] /api/login attempting for identifier:', ident);
  
  db.get('SELECT * FROM users WHERE email = ? COLLATE NOCASE OR nickname = ? COLLATE NOCASE', [ident, ident], (err, user) => {
    if (err || !user) {
      res.setHeader('Content-Type', 'application/json');
      return res.status(400).json({ error: 'Invalid credentials' });
    }
    
    console.log('[API] /api/login found user:', user.id);
    bcrypt.compare(password, user.password, (err, result) => {
      if (result) {
        const token = jwt.sign({ userId: user.id }, SECRET, { expiresIn: '1d' });
        const responseData = { token, user: { id: user.id, email: user.email, nickname: user.nickname } };
        
        console.log('[API] /api/login sending successful response');
        return res.status(200).json(responseData);
      } else {
        console.log('[API] /api/login password comparison failed');
        res.setHeader('Content-Type', 'application/json');
        res.status(400).json({ error: 'Invalid credentials' });
      }
    });
  });
});

// Auth middleware — also updates last_seen timestamp on every authenticated call
function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  if (!token) return res.sendStatus(401);
  jwt.verify(token, SECRET, (err, user) => {
    if (err) return res.sendStatus(403);
    req.user = user;
    db.run('UPDATE users SET last_seen = CURRENT_TIMESTAMP WHERE id = ?', [user.userId], () => {});
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
    logActivity(req.user.userId, 'creature_added', { name: (data||{}).name || 'Unnamed', species: (data||{}).species || '' });
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
    const tradeId = this.lastID;
    // Notify users who wishlisted this species
    const listedSpecies = (creature_data && creature_data.species) ? creature_data.species : null;
    if (listedSpecies) {
      db.all('SELECT user_id FROM wishlists WHERE species = ? AND user_id != ?', [listedSpecies, req.user.userId], (we, wishers) => {
        if (!we && wishers && wishers.length > 0) {
          const payload = JSON.stringify({ species: listedSpecies, tradeId });
          wishers.forEach(w => {
            db.run('INSERT INTO notifications (user_id, actor_user_id, type, payload, read) VALUES (?, ?, ?, ?, 0)',
              [w.user_id, req.user.userId, 'wishlist_listed', payload], () => {});
          });
        }
      });
    }
    res.setHeader('Content-Type', 'application/json');
    return res.status(201).json({ success: true, id: tradeId });
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
                logActivity(req.user.userId, 'trade_completed', { creature: tradeRow.creature_data });
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
                logActivity(req.user.userId, 'trade_completed', { creature: tradeRow.creature_data });
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

// ── Discord OAuth ─────────────────────────────────────────────────────────────

function discordPost(path, data) {
  const body = querystring.stringify(data);
  return new Promise((resolve, reject) => {
    const req = https.request({
      hostname: 'discord.com', path, method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'Content-Length': Buffer.byteLength(body) }
    }, res => { let d = ''; res.on('data', c => d += c); res.on('end', () => { try { resolve(JSON.parse(d)); } catch { resolve(d); } }); });
    req.on('error', reject);
    req.write(body); req.end();
  });
}

function discordGet(path, token) {
  return new Promise((resolve, reject) => {
    const req = https.request({
      hostname: 'discord.com', path, method: 'GET',
      headers: { Authorization: `Bearer ${token}` }
    }, res => { let d = ''; res.on('data', c => d += c); res.on('end', () => { try { resolve(JSON.parse(d)); } catch { resolve(d); } }); });
    req.on('error', reject);
    req.end();
  });
}

// Step 1 — redirect user to Discord to authorise
app.get('/api/auth/discord/start', (req, res) => {
  const clientId = process.env.DISCORD_CLIENT_ID;
  if (!clientId) return res.status(500).json({ error: 'Discord not configured' });
  const redirectUri = process.env.DISCORD_REDIRECT_URI || 'https://nuggie-1.onrender.com/';
  const url = `https://discord.com/api/oauth2/authorize?client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=code&scope=identify%20email`;
  res.redirect(url);
});

// Step 2 — frontend sends the code here; we exchange it for a JWT
app.post('/api/auth/discord/callback', async (req, res) => {
  const { code } = req.body || {};
  if (!code) return res.status(400).json({ error: 'Missing code' });

  const clientId     = process.env.DISCORD_CLIENT_ID;
  const clientSecret = process.env.DISCORD_CLIENT_SECRET;
  const redirectUri  = process.env.DISCORD_REDIRECT_URI || 'https://nuggie-1.onrender.com/';

  if (!clientId || !clientSecret) return res.status(500).json({ error: 'Discord not configured on server' });

  try {
    // Exchange code for access token
    const tokenData = await discordPost('/api/oauth2/token', {
      client_id: clientId, client_secret: clientSecret,
      grant_type: 'authorization_code', code, redirect_uri: redirectUri
    });
    if (!tokenData.access_token) {
      console.error('Discord token exchange failed:', tokenData);
      return res.status(400).json({ error: 'Discord authorisation failed. The login link may have expired — please try again.' });
    }

    // Get Discord user profile
    const profile = await discordGet('/api/users/@me', tokenData.access_token);
    const discordId    = profile.id;
    const discordEmail = profile.email || `discord_${profile.id}@discord.local`;
    const discordName  = profile.username || profile.global_name || 'DiscordUser';

    const issueJWT = (userId, email, nickname) => {
      const token = jwt.sign({ userId, email }, SECRET, { expiresIn: '7d' });
      return res.json({ token, user: { id: userId, email, nickname: nickname || discordName, discord_name: discordName } });
    };

    // 1. Existing user linked by Discord ID
    db.get('SELECT * FROM users WHERE discord_id = ?', [discordId], (err, user) => {
      if (user) return issueJWT(user.id, user.email, user.nickname);

      // 2. Existing user matched by email — link their Discord
      db.get('SELECT * FROM users WHERE email = ?', [discordEmail], (err2, existing) => {
        if (existing) {
          // Link Discord ID — silently ignored if column not yet in schema
          db.run('UPDATE users SET discord_id = ?, discord_name = ? WHERE id = ?', [discordId, discordName, existing.id], () => {});
          return issueJWT(existing.id, existing.email, existing.nickname);
        }

        // 3. Brand new user — insert without discord_id first (column may not exist yet on old DBs)
        db.run(
          'INSERT INTO users (email, nickname, discord_name, password) VALUES (?, ?, ?, ?)',
          [discordEmail, discordName, discordName, ''],
          function(err3) {
            if (err3) {
              console.error('Discord user creation error:', err3);
              // If email uniqueness failed it means the account exists but under a different discord id
              if (err3.message && err3.message.includes('UNIQUE')) {
                return res.status(400).json({ error: 'An account with this email already exists. Please log in with your email and password instead.' });
              }
              return res.status(500).json({ error: 'Failed to create account. Please try again.' });
            }
            const newId = this.lastID;
            // Store discord_id via UPDATE — silently ignored if column doesn't exist yet
            db.run('UPDATE users SET discord_id = ? WHERE id = ?', [discordId, newId], () => {});
            issueJWT(newId, discordEmail, discordName);
          }
        );
      });
    });
  } catch (e) {
    console.error('Discord auth error:', e);
    res.status(500).json({ error: 'Discord authentication error' });
  }
});

// --- Profile endpoints ---
// Get user profile with extended information
app.get('/api/profile', authenticateToken, (req, res) => {
  const userId = req.user.userId;
  
  // Get user info
  db.get('SELECT id, email, nickname, discord_name, created_at, bio, banner_image, looking_for, pinned_creatures FROM users WHERE id = ?', [userId], (err, user) => {
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
            created_at: user.created_at,
            bio: user.bio || '',
            banner_image: user.banner_image || null,
            looking_for: user.looking_for || null,
            pinned_creatures: (() => { try { return JSON.parse(user.pinned_creatures || '[]'); } catch { return []; } })(),
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

// Update user profile (nickname, email, discord_name)
app.put('/api/profile', authenticateToken, (req, res) => {
  const userId = req.user.userId;
  const { nickname, email, discord_name, bio, banner_image, looking_for } = req.body || {};
  // Build update dynamically for only provided fields
  const fields = [];
  const values = [];
  if (discord_name !== undefined) { fields.push('discord_name = ?'); values.push(discord_name || null); }
  if (nickname !== undefined) { fields.push('nickname = ?'); values.push(nickname || null); }
  if (email !== undefined) { fields.push('email = ?'); values.push(email || null); }
  if (bio !== undefined) { fields.push('bio = ?'); values.push(bio ? String(bio).slice(0, 280) : null); }
  if (banner_image !== undefined) { fields.push('banner_image = ?'); values.push(banner_image || null); }
  if (looking_for !== undefined) { fields.push('looking_for = ?'); values.push(looking_for || null); }
  if (!fields.length) return res.status(400).json({ error: 'No fields to update' });
  values.push(userId);
  db.run(`UPDATE users SET ${fields.join(', ')} WHERE id = ?`, values, function(err) {
    if (err) {
      if (err.message && err.message.includes('UNIQUE')) return res.status(400).json({ error: 'Nickname or email already taken' });
      return res.status(500).json({ error: 'Failed to update profile' });
    }
    res.json({ success: true });
  });
});

// Get online user IDs (seen within last 5 minutes)
app.get('/api/users/online', authenticateToken, (req, res) => {
  db.all(`SELECT id FROM users WHERE last_seen > datetime('now', '-5 minutes')`, [], (err, rows) => {
    if (err) return res.status(500).json({ error: 'Failed to fetch online users' });
    res.json({ online_ids: (rows || []).map(r => r.id) });
  });
});

// Update pinned creatures list (max 6)
app.put('/api/profile/pinned', authenticateToken, (req, res) => {
  const userId = req.user.userId;
  const { creature_ids } = req.body || {};
  if (!Array.isArray(creature_ids)) return res.status(400).json({ error: 'creature_ids must be an array' });
  const pinned = JSON.stringify(creature_ids.slice(0, 6).map(Number).filter(Boolean));
  db.run('UPDATE users SET pinned_creatures = ? WHERE id = ?', [pinned, userId], function(err) {
    if (err) return res.status(500).json({ error: 'Failed to update pinned creatures' });
    res.json({ success: true, pinned_creatures: JSON.parse(pinned) });
  });
});

// Change password
app.put('/api/profile/password', authenticateToken, (req, res) => {
  const userId = req.user.userId;
  const { current_password, new_password } = req.body || {};
  if (!current_password || !new_password) return res.status(400).json({ error: 'Missing fields' });
  if (new_password.length < 6) return res.status(400).json({ error: 'New password must be at least 6 characters' });
  db.get('SELECT password FROM users WHERE id = ?', [userId], (err, user) => {
    if (err || !user) return res.status(404).json({ error: 'User not found' });
    bcrypt.compare(current_password, user.password, (err, match) => {
      if (!match) return res.status(400).json({ error: 'Current password is incorrect' });
      bcrypt.hash(new_password, 10, (err, hash) => {
        if (err) return res.status(500).json({ error: 'Failed to hash password' });
        db.run('UPDATE users SET password = ? WHERE id = ?', [hash, userId], (err) => {
          if (err) return res.status(500).json({ error: 'Failed to update password' });
          res.json({ success: true });
        });
      });
    });
  });
});

// Delete account
app.delete('/api/profile', authenticateToken, (req, res) => {
  const userId = req.user.userId;
  const { password } = req.body || {};
  if (!password) return res.status(400).json({ error: 'Password required to delete account' });
  db.get('SELECT password FROM users WHERE id = ?', [userId], (err, user) => {
    if (err || !user) return res.status(404).json({ error: 'User not found' });
    bcrypt.compare(password, user.password, (err, match) => {
      if (!match) return res.status(400).json({ error: 'Incorrect password' });
      // Cascade delete all user data
      db.serialize(() => {
        db.run('DELETE FROM creature_cards WHERE user_id = ?', [userId]);
        db.run('DELETE FROM friends WHERE user_id = ? OR friend_user_id = ?', [userId, userId]);
        db.run('DELETE FROM tribe_memberships WHERE user_id = ?', [userId]);
        db.run('DELETE FROM trades WHERE user_id = ?', [userId]);
        db.run('DELETE FROM offers WHERE from_user_id = ? OR to_user_id = ?', [userId, userId]);
        db.run('DELETE FROM notifications WHERE user_id = ? OR actor_user_id = ?', [userId, userId]);
        db.run('DELETE FROM boss_planner WHERE user_id = ?', [userId]);
        db.run('DELETE FROM users WHERE id = ?', [userId], function(err) {
          if (err) return res.status(500).json({ error: 'Failed to delete account' });
          res.json({ success: true });
        });
      });
    });
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

    // Create friend request and notify recipient
    db.run(`INSERT INTO friends (user_id, friend_user_id, status) VALUES (?, ?, 'pending')`,
      [userId, friend_user_id], function(err) {
      if (err) return res.status(500).json({ error: 'Failed to send friend request' });
      try {
        db.run('INSERT INTO notifications (user_id, actor_user_id, type, payload, read) VALUES (?, ?, ?, ?, ?)',
          [friend_user_id, userId, 'friend_request', JSON.stringify({ friendshipId: this.lastID }), 0]);
      } catch (e) {}
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
  } else if (status === 'sent') {
    statusCondition = `AND f.status = 'pending' AND f.user_id = ${userId}`;
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

// Get any user's creature cards (used by View Creatures on Friends page)
app.get('/api/users/:id/creatures', authenticateToken, (req, res) => {
  const targetId = req.params.id;
  db.all('SELECT id, data FROM creature_cards WHERE user_id = ?', [targetId], (err, rows) => {
    if (err) return res.status(500).json({ error: 'Failed to load' });
    try {
      const parsed = (rows || []).map(r => ({ id: r.id, ...JSON.parse(r.data || '{}') }));
      res.json(parsed);
    } catch (e) { res.status(500).json({ error: 'Failed to parse' }); }
  });
});

// ── Tribe Alliances ───────────────────────────────────────────────────────────

// Get alliances for user's tribe
app.get('/api/alliances', authenticateToken, (req, res) => {
  const userId = req.user.userId;
  db.get('SELECT tribe_id FROM tribe_memberships WHERE user_id = ?', [userId], (err, mem) => {
    if (err || !mem) return res.json([]);
    const tribeId = mem.tribe_id;
    db.all(`
      SELECT ta.*,
             t1.name as tribe_name, t2.name as ally_name
      FROM tribe_alliances ta
      JOIN tribes t1 ON ta.tribe_id = t1.id
      JOIN tribes t2 ON ta.ally_tribe_id = t2.id
      WHERE (ta.tribe_id = ? OR ta.ally_tribe_id = ?)`, [tribeId, tribeId], (e, rows) => {
      res.json(rows || []);
    });
  });
});

// Request alliance
app.post('/api/alliances', authenticateToken, (req, res) => {
  const userId = req.user.userId;
  const { ally_tribe_id } = req.body || {};
  db.get('SELECT tribe_id, role FROM tribe_memberships WHERE user_id = ?', [userId], (err, mem) => {
    if (err || !mem) return res.status(403).json({ error: 'Not in a tribe' });
    if (!['owner','admin'].includes(mem.role)) return res.status(403).json({ error: 'Must be tribe owner or admin' });
    db.run(`INSERT OR IGNORE INTO tribe_alliances (tribe_id, ally_tribe_id, status, requested_by) VALUES (?, ?, 'pending', ?)`,
      [mem.tribe_id, ally_tribe_id, userId], function(err) {
      if (err) return res.status(500).json({ error: 'Failed to request alliance' });
      res.status(201).json({ success: true });
    });
  });
});

// Accept/decline alliance
app.put('/api/alliances/:id', authenticateToken, (req, res) => {
  const userId = req.user.userId;
  const { status } = req.body || {};
  if (!['accepted','declined'].includes(status)) return res.status(400).json({ error: 'Invalid status' });
  db.get('SELECT ta.*, tm.role FROM tribe_alliances ta JOIN tribe_memberships tm ON tm.tribe_id = ta.ally_tribe_id WHERE ta.id = ? AND tm.user_id = ?',
    [req.params.id, userId], (err, row) => {
    if (err || !row) return res.status(403).json({ error: 'Not authorized' });
    if (!['owner','admin'].includes(row.role)) return res.status(403).json({ error: 'Must be owner or admin' });
    db.run('UPDATE tribe_alliances SET status = ? WHERE id = ?', [status, req.params.id], () => res.json({ success: true }));
  });
});

// Alliance chat
app.get('/api/alliances/:id/chat', authenticateToken, (req, res) => {
  const userId = req.user.userId;
  db.all(`SELECT ac.*, u.nickname as sender FROM alliance_chat ac JOIN users u ON ac.user_id = u.id
    WHERE ac.alliance_id = ? ORDER BY ac.created_at ASC LIMIT 100`, [req.params.id], (err, rows) => {
    res.json(rows || []);
  });
});

app.post('/api/alliances/:id/chat', authenticateToken, (req, res) => {
  const { message } = req.body || {};
  if (!message) return res.status(400).json({ error: 'Message required' });
  db.run('INSERT INTO alliance_chat (alliance_id, user_id, message) VALUES (?, ?, ?)',
    [req.params.id, req.user.userId, message.trim().slice(0, 1000)], function(err) {
    if (err) return res.status(500).json({ error: 'Failed to send' });
    res.status(201).json({ success: true, id: this.lastID });
  });
});

// ── Public Creature Page ──────────────────────────────────────────────────────

// No auth required — returns creature + owner info for shareable URLs
app.get('/api/creatures/public/:id', (req, res) => {
  const id = parseInt(req.params.id);
  db.get(`SELECT cc.id, cc.data, cc.created_at, u.id as owner_id, u.nickname as owner_nickname
    FROM creature_cards cc JOIN users u ON cc.user_id = u.id WHERE cc.id = ?`, [id], (err, row) => {
    if (err || !row) return res.status(404).json({ error: 'Creature not found' });
    let data = {}; try { data = JSON.parse(row.data || '{}'); } catch {}
    res.json({ id: row.id, data, owner_id: row.owner_id, owner_nickname: row.owner_nickname, created_at: row.created_at });
  });
});

// ── Marketplace Upgrades: Wishlists + Ratings ─────────────────────────────────

// Wishlists
app.get('/api/wishlists', authenticateToken, (req, res) => {
  db.all('SELECT species FROM wishlists WHERE user_id = ?', [req.user.userId], (err, rows) => {
    res.json((rows || []).map(r => r.species));
  });
});

app.post('/api/wishlists', authenticateToken, (req, res) => {
  const { species } = req.body || {};
  if (!species) return res.status(400).json({ error: 'species required' });
  db.run('INSERT OR IGNORE INTO wishlists (user_id, species) VALUES (?, ?)', [req.user.userId, species], function(err) {
    if (err) return res.status(500).json({ error: 'Failed' });
    res.json({ success: true, added: this.changes > 0 });
  });
});

app.delete('/api/wishlists/:species', authenticateToken, (req, res) => {
  db.run('DELETE FROM wishlists WHERE user_id = ? AND species = ?', [req.user.userId, decodeURIComponent(req.params.species)], function(err) {
    res.json({ success: true });
  });
});

// When a trade is created, notify users who wishlisted that species
// (injected into POST /api/trades after successful insert — handled in the trade route below via hook)

// Seller Ratings
app.get('/api/ratings/:userId', (req, res) => {
  db.get('SELECT AVG(rating) as avg_rating, COUNT(*) as count FROM trade_ratings WHERE rated_user_id = ?', [req.params.userId], (err, row) => {
    if (err) return res.status(500).json({ error: 'Failed' });
    res.json({ avg_rating: row?.avg_rating ? Math.round(row.avg_rating * 10) / 10 : null, count: row?.count || 0 });
  });
});

app.post('/api/ratings', authenticateToken, (req, res) => {
  const { rated_user_id, trade_id, rating, comment } = req.body || {};
  if (!rated_user_id || !rating || rating < 1 || rating > 5) return res.status(400).json({ error: 'rated_user_id and rating (1-5) required' });
  if (rated_user_id === req.user.userId) return res.status(400).json({ error: 'Cannot rate yourself' });
  db.run('INSERT OR IGNORE INTO trade_ratings (rater_id, rated_user_id, trade_id, rating, comment) VALUES (?, ?, ?, ?, ?)',
    [req.user.userId, rated_user_id, trade_id || null, rating, comment || null], function(err) {
    if (err) return res.status(500).json({ error: 'Failed to save rating' });
    res.json({ success: true, inserted: this.changes > 0 });
  });
});

// ── Reactions ─────────────────────────────────────────────────────────────────

const ALLOWED_EMOJIS = ['❤️','🔥','💪','😮','👑','🤣'];

// Get reactions for a batch of entities: ?type=X&ids=1,2,3
app.get('/api/reactions', authenticateToken, (req, res) => {
  const { type, ids } = req.query;
  if (!type || !ids) return res.json({});
  const idList = String(ids).split(',').map(Number).filter(Boolean).slice(0, 50);
  if (!idList.length) return res.json({});
  const placeholders = idList.map(() => '?').join(',');
  db.all(`SELECT entity_id, emoji, COUNT(*) as count, MAX(CASE WHEN user_id = ? THEN 1 ELSE 0 END) as my_react
    FROM reactions WHERE entity_type = ? AND entity_id IN (${placeholders}) GROUP BY entity_id, emoji`,
    [req.user.userId, type, ...idList], (err, rows) => {
    if (err) return res.status(500).json({ error: 'Failed' });
    // Group by entity_id
    const result = {};
    (rows || []).forEach(r => {
      if (!result[r.entity_id]) result[r.entity_id] = [];
      result[r.entity_id].push({ emoji: r.emoji, count: r.count, my_react: !!r.my_react });
    });
    res.json(result);
  });
});

// Toggle a reaction (add if not present, remove if present)
app.post('/api/reactions/toggle', authenticateToken, (req, res) => {
  const { entity_type, entity_id, emoji } = req.body || {};
  if (!entity_type || !entity_id || !ALLOWED_EMOJIS.includes(emoji)) return res.status(400).json({ error: 'Invalid request' });
  db.get('SELECT id FROM reactions WHERE user_id = ? AND entity_type = ? AND entity_id = ?',
    [req.user.userId, entity_type, entity_id], (err, existing) => {
    if (existing) {
      db.run('DELETE FROM reactions WHERE id = ?', [existing.id], () => res.json({ action: 'removed' }));
    } else {
      db.run('INSERT INTO reactions (user_id, entity_type, entity_id, emoji) VALUES (?, ?, ?, ?)',
        [req.user.userId, entity_type, entity_id, emoji], () => res.json({ action: 'added' }));
    }
  });
});

// ── Events / Calendar ─────────────────────────────────────────────────────────

// List upcoming events for the user (own + friends/tribe events)
app.get('/api/events', authenticateToken, (req, res) => {
  const userId = req.user.userId;
  db.all(`
    SELECT e.*, u.nickname as creator_nickname,
           COUNT(DISTINCT er.id) as rsvp_count,
           MAX(CASE WHEN er.user_id = ? THEN er.status END) as my_rsvp
    FROM events e
    JOIN users u ON e.creator_id = u.id
    LEFT JOIN event_rsvps er ON e.id = er.event_id
    WHERE e.scheduled_at > datetime('now')
       OR e.creator_id = ?
    GROUP BY e.id
    ORDER BY e.scheduled_at ASC LIMIT 50`, [userId, userId], (err, rows) => {
    if (err) return res.status(500).json({ error: 'Failed to fetch events' });
    res.json(rows || []);
  });
});

app.get('/api/events/:id', authenticateToken, (req, res) => {
  const userId = req.user.userId;
  db.get(`SELECT e.*, u.nickname as creator_nickname FROM events e JOIN users u ON e.creator_id = u.id WHERE e.id = ?`, [req.params.id], (err, event) => {
    if (err || !event) return res.status(404).json({ error: 'Event not found' });
    db.all(`SELECT er.status, u.nickname FROM event_rsvps er JOIN users u ON er.user_id = u.id WHERE er.event_id = ?`, [req.params.id], (e2, rsvps) => {
      res.json({ ...event, rsvps: rsvps || [], my_rsvp: (rsvps || []).find(r => r.user_id === userId)?.status || null });
    });
  });
});

app.post('/api/events', authenticateToken, (req, res) => {
  const { title, description, event_type, map_name, scheduled_at, max_attendees } = req.body || {};
  if (!title || !scheduled_at) return res.status(400).json({ error: 'title and scheduled_at required' });
  db.run('INSERT INTO events (creator_id, title, description, event_type, map_name, scheduled_at, max_attendees) VALUES (?, ?, ?, ?, ?, ?, ?)',
    [req.user.userId, title, description || null, event_type || 'general', map_name || null, scheduled_at, max_attendees || null], function(err) {
    if (err) return res.status(500).json({ error: 'Failed to create event' });
    // Auto-RSVP creator as going
    db.run('INSERT OR REPLACE INTO event_rsvps (event_id, user_id, status) VALUES (?, ?, ?)', [this.lastID, req.user.userId, 'going'], () => {});
    logActivity(req.user.userId, 'event_created', { title, event_type: event_type || 'general' });
    res.status(201).json({ success: true, id: this.lastID });
  });
});

app.put('/api/events/:id/rsvp', authenticateToken, (req, res) => {
  const { status } = req.body || {};
  if (!['going', 'maybe', 'declined'].includes(status)) return res.status(400).json({ error: 'Invalid status' });
  db.run('INSERT OR REPLACE INTO event_rsvps (event_id, user_id, status) VALUES (?, ?, ?)',
    [req.params.id, req.user.userId, status], function(err) {
    if (err) return res.status(500).json({ error: 'Failed to RSVP' });
    res.json({ success: true });
  });
});

app.delete('/api/events/:id', authenticateToken, (req, res) => {
  db.run('DELETE FROM events WHERE id = ? AND creator_id = ?', [req.params.id, req.user.userId], function(err) {
    if (err) return res.status(500).json({ error: 'Failed to delete' });
    if (this.changes === 0) return res.status(403).json({ error: 'Not authorized' });
    res.json({ success: true });
  });
});

// ── Direct Messages ───────────────────────────────────────────────────────────

// List conversations (one entry per partner, with last message + unread count)
app.get('/api/dms', authenticateToken, (req, res) => {
  const userId = req.user.userId;
  db.all(`
    SELECT
      CASE WHEN dm.from_user_id = ? THEN dm.to_user_id ELSE dm.from_user_id END as partner_id,
      CASE WHEN dm.from_user_id = ? THEN tu.nickname ELSE fu.nickname END as partner_nickname,
      dm.message as last_message, dm.created_at as last_at,
      SUM(CASE WHEN dm.to_user_id = ? AND dm.read = 0 THEN 1 ELSE 0 END) as unread
    FROM direct_messages dm
    JOIN users fu ON dm.from_user_id = fu.id
    JOIN users tu ON dm.to_user_id = tu.id
    WHERE dm.from_user_id = ? OR dm.to_user_id = ?
    GROUP BY partner_id
    ORDER BY last_at DESC`, [userId, userId, userId, userId, userId], (err, rows) => {
    if (err) return res.status(500).json({ error: 'Failed to fetch conversations' });
    res.json(rows || []);
  });
});

// Get thread with a specific user
app.get('/api/dms/:userId', authenticateToken, (req, res) => {
  const me = req.user.userId;
  const other = parseInt(req.params.userId);
  db.all(`
    SELECT dm.*, u.nickname as sender_nickname
    FROM direct_messages dm JOIN users u ON dm.from_user_id = u.id
    WHERE (dm.from_user_id = ? AND dm.to_user_id = ?) OR (dm.from_user_id = ? AND dm.to_user_id = ?)
    ORDER BY dm.created_at ASC LIMIT 100`, [me, other, other, me], (err, rows) => {
    if (err) return res.status(500).json({ error: 'Failed to fetch messages' });
    // mark as read
    db.run('UPDATE direct_messages SET read = 1 WHERE to_user_id = ? AND from_user_id = ?', [me, other], () => {});
    res.json(rows || []);
  });
});

// Send a message
app.post('/api/dms/:userId', authenticateToken, (req, res) => {
  const me = req.user.userId;
  const other = parseInt(req.params.userId);
  const { message } = req.body || {};
  if (!message || !message.trim()) return res.status(400).json({ error: 'Message is required' });
  if (me === other) return res.status(400).json({ error: 'Cannot message yourself' });
  db.run('INSERT INTO direct_messages (from_user_id, to_user_id, message) VALUES (?, ?, ?)',
    [me, other, message.trim().slice(0, 1000)], function(err) {
    if (err) return res.status(500).json({ error: 'Failed to send message' });
    // Create notification for recipient
    db.get('SELECT nickname FROM users WHERE id = ?', [me], (e, u) => {
      const payload = JSON.stringify({ fromUserId: me, fromNickname: u?.nickname || 'Someone' });
      db.run('INSERT INTO notifications (user_id, actor_user_id, type, payload, read) VALUES (?, ?, ?, ?, 0)',
        [other, me, 'direct_message', payload], () => {});
    });
    res.status(201).json({ success: true, id: this.lastID });
  });
});

// Unread DM count for header badge
app.get('/api/dms/unread/count', authenticateToken, (req, res) => {
  db.get('SELECT COUNT(*) as count FROM direct_messages WHERE to_user_id = ? AND read = 0', [req.user.userId], (err, row) => {
    if (err) return res.status(500).json({ error: 'Failed' });
    res.json({ count: row?.count || 0 });
  });
});

// ── Boss Fight Records ────────────────────────────────────────────────────────

app.get('/api/boss-records', authenticateToken, (req, res) => {
  db.all('SELECT * FROM boss_fight_records WHERE user_id = ? ORDER BY created_at DESC LIMIT 100', [req.user.userId], (err, rows) => {
    if (err) return res.status(500).json({ error: 'Failed to fetch boss records' });
    res.json((rows || []).map(r => ({ ...r, creatures_used: (() => { try { return JSON.parse(r.creatures_used); } catch { return []; } })() })));
  });
});

app.post('/api/boss-records', authenticateToken, (req, res) => {
  const { boss_name, map_name, difficulty, outcome, notes, creatures_used } = req.body || {};
  if (!boss_name) return res.status(400).json({ error: 'boss_name required' });
  const creaturesStr = JSON.stringify(Array.isArray(creatures_used) ? creatures_used : []);
  db.run('INSERT INTO boss_fight_records (user_id, boss_name, map_name, difficulty, outcome, notes, creatures_used) VALUES (?, ?, ?, ?, ?, ?, ?)',
    [req.user.userId, boss_name, map_name || null, difficulty || null, outcome || 'success', notes || null, creaturesStr], function(err) {
    if (err) return res.status(500).json({ error: 'Failed to save' });
    logActivity(req.user.userId, 'boss_kill', { boss_name, difficulty, outcome });
    res.status(201).json({ success: true, id: this.lastID });
  });
});

// Summary: kills per boss for a user (achievements)
app.get('/api/boss-records/summary', authenticateToken, (req, res) => {
  db.all(`SELECT boss_name, difficulty, outcome, COUNT(*) as count FROM boss_fight_records WHERE user_id = ? GROUP BY boss_name, difficulty, outcome ORDER BY count DESC`,
    [req.user.userId], (err, rows) => {
    if (err) return res.status(500).json({ error: 'Failed to fetch summary' });
    res.json(rows || []);
  });
});

// ── Wild Find Reports ─────────────────────────────────────────────────────────

app.get('/api/wild-finds', authenticateToken, (req, res) => {
  db.all(`
    SELECT wf.*, u.nickname as reporter_nickname
    FROM wild_finds wf JOIN users u ON wf.user_id = u.id
    WHERE wf.created_at > datetime('now', '-24 hours')
    ORDER BY wf.level DESC, wf.created_at DESC
    LIMIT 50`, [], (err, rows) => {
    if (err) return res.status(500).json({ error: 'Failed to fetch wild finds' });
    res.json(rows || []);
  });
});

app.post('/api/wild-finds', authenticateToken, (req, res) => {
  const { species, level, map_name, coordinates, notes } = req.body || {};
  if (!species || !level) return res.status(400).json({ error: 'species and level are required' });
  const lvl = Math.max(1, Math.min(9999, parseInt(level) || 1));
  db.run('INSERT INTO wild_finds (user_id, species, level, map_name, coordinates, notes) VALUES (?, ?, ?, ?, ?, ?)',
    [req.user.userId, species, lvl, map_name || null, coordinates || null, notes || null], function(err) {
    if (err) return res.status(500).json({ error: 'Failed to save' });
    logActivity(req.user.userId, 'wild_find', { species, level: lvl, map: map_name || '' });
    res.status(201).json({ success: true, id: this.lastID });
  });
});

app.delete('/api/wild-finds/:id', authenticateToken, (req, res) => {
  db.run('DELETE FROM wild_finds WHERE id = ? AND user_id = ?', [req.params.id, req.user.userId], function(err) {
    if (err) return res.status(500).json({ error: 'Failed to delete' });
    res.json({ success: true });
  });
});

// ── Activity Feed ─────────────────────────────────────────────────────────────
// Helper: log an activity event for a user
function logActivity(userId, type, data) {
  db.run('INSERT INTO activity_events (user_id, type, data_json) VALUES (?, ?, ?)',
    [userId, type, JSON.stringify(data || {})], () => {});
}

// GET /api/feed — events from friends + own tribe within the last 30 days, 40 most recent
app.get('/api/feed', authenticateToken, (req, res) => {
  const userId = req.user.userId;
  db.all(`
    SELECT DISTINCT f.friend_user_id as fid FROM friends f WHERE f.user_id = ? AND f.status = 'accepted'
    UNION
    SELECT DISTINCT f.user_id as fid FROM friends f WHERE f.friend_user_id = ? AND f.status = 'accepted'
    UNION SELECT ?`, [userId, userId, userId], (err, rows) => {
    if (err) return res.status(500).json({ error: 'Failed to fetch feed' });
    const feedUserIds = (rows || []).map(r => r.fid);
    const placeholders = feedUserIds.map(() => '?').join(',');

    // Get explicit activity events
    const eventsQ = `
      SELECT ae.id, ae.user_id, ae.type, ae.data_json, ae.created_at,
             u.nickname as actor_nickname
      FROM activity_events ae JOIN users u ON ae.user_id = u.id
      WHERE ae.user_id IN (${placeholders})
        AND ae.created_at > datetime('now', '-30 days')
      ORDER BY ae.created_at DESC LIMIT 30`;

    // Get recent creature additions
    const creaturesQ = `
      SELECT cc.id, cc.user_id, cc.data, cc.created_at,
             u.nickname as actor_nickname
      FROM creature_cards cc JOIN users u ON cc.user_id = u.id
      WHERE cc.user_id IN (${placeholders})
        AND cc.created_at > datetime('now', '-7 days')
      ORDER BY cc.created_at DESC LIMIT 20`;

    Promise.all([
      new Promise(resolve => db.all(eventsQ, feedUserIds, (e, r) => resolve(r || []))),
      new Promise(resolve => db.all(creaturesQ, feedUserIds, (e, r) => resolve(r || [])))
    ]).then(([events, creatures]) => {
      const feed = [];
      events.forEach(e => {
        let data = {}; try { data = JSON.parse(e.data_json || '{}'); } catch {}
        feed.push({ id: `ev_${e.id}`, type: e.type, actor: e.actor_nickname || 'Unknown', actor_id: e.user_id, data, created_at: e.created_at });
      });
      creatures.forEach(c => {
        if (c.user_id === userId) return; // skip own creature adds in feed (too noisy)
        let d = {}; try { d = JSON.parse(c.data || '{}'); } catch {}
        feed.push({ id: `cc_${c.id}`, type: 'creature_added', actor: c.actor_nickname || 'Unknown', actor_id: c.user_id, data: { name: d.name || 'Unnamed', species: d.species || '', level: d.level || '' }, created_at: c.created_at });
      });
      feed.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
      res.json(feed.slice(0, 40));
    });
  });
});

// ── Leaderboard endpoints ────────────────────────────────────────────────────

// Top creatures by a numeric base stat (Melee, Health, Stamina, Speed, Weight, Oxygen)
app.get('/api/leaderboards/creatures', authenticateToken, (req, res) => {
  const stat = ['Melee','Health','Stamina','Speed','Weight','Oxygen'].includes(req.query.stat) ? req.query.stat : 'Melee';
  const limit = Math.min(parseInt(req.query.limit) || 10, 25);
  db.all(`
    SELECT cc.id, cc.data, u.nickname, u.id as owner_id,
           CAST(json_extract(cc.data, '$.baseStats.${stat}') AS REAL) as stat_val
    FROM creature_cards cc
    JOIN users u ON cc.user_id = u.id
    WHERE json_extract(cc.data, '$.baseStats.${stat}') IS NOT NULL
    ORDER BY stat_val DESC
    LIMIT ?`, [limit], (err, rows) => {
    if (err) return res.status(500).json({ error: 'Failed to fetch creature leaderboard' });
    res.json((rows || []).map(r => {
      let d = {}; try { d = JSON.parse(r.data || '{}'); } catch {}
      return { id: r.id, name: d.name || 'Unnamed', species: d.species || '', stat_val: r.stat_val, owner: r.nickname || 'Unknown', owner_id: r.owner_id };
    }));
  });
});

// Top players by creature count, trade count, or friend count
app.get('/api/leaderboards/players', authenticateToken, (req, res) => {
  const type = req.query.type || 'creatures';
  const limit = Math.min(parseInt(req.query.limit) || 10, 25);
  let query;
  if (type === 'traders') {
    query = `SELECT u.id, u.nickname, COUNT(t.id) as score FROM users u LEFT JOIN trades t ON t.user_id = u.id AND t.status = 'completed' GROUP BY u.id ORDER BY score DESC LIMIT ?`;
  } else if (type === 'friends') {
    query = `SELECT u.id, u.nickname, COUNT(f.id) as score FROM users u LEFT JOIN friends f ON (f.user_id = u.id OR f.friend_user_id = u.id) AND f.status = 'accepted' GROUP BY u.id ORDER BY score DESC LIMIT ?`;
  } else {
    query = `SELECT u.id, u.nickname, COUNT(cc.id) as score FROM users u LEFT JOIN creature_cards cc ON cc.user_id = u.id GROUP BY u.id ORDER BY score DESC LIMIT ?`;
  }
  db.all(query, [limit], (err, rows) => {
    if (err) return res.status(500).json({ error: 'Failed to fetch player leaderboard' });
    res.json((rows || []).map((r, i) => ({ rank: i + 1, id: r.id, nickname: r.nickname || 'Unknown', score: r.score || 0 })));
  });
});

// Top tribes by member count
app.get('/api/leaderboards/tribes', authenticateToken, (req, res) => {
  const limit = Math.min(parseInt(req.query.limit) || 10, 25);
  db.all(`
    SELECT t.id, t.name, COUNT(tm.user_id) as member_count
    FROM tribes t LEFT JOIN tribe_memberships tm ON t.id = tm.tribe_id
    GROUP BY t.id ORDER BY member_count DESC LIMIT ?`, [limit], (err, rows) => {
    if (err) return res.status(500).json({ error: 'Failed to fetch tribe leaderboard' });
    res.json((rows || []).map((r, i) => ({ rank: i + 1, id: r.id, name: r.name || 'Unknown', member_count: r.member_count || 0 })));
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

// Get the authenticated user's current tribe (the first tribe they belong to)
app.get('/api/my-tribe', authenticateToken, (req, res) => {
  db.get(
    `SELECT t.id, t.name, t.main_map, t.description, t.flag_image, t.colors, t.owner_user_id, m.role
     FROM tribe_memberships m JOIN tribes t ON m.tribe_id = t.id
     WHERE m.user_id = ? LIMIT 1`,
    [req.user.userId],
    (err, row) => {
      if (err) return res.status(500).json({ error: 'Failed to load tribe' });
      if (!row) return res.json(null);
      try { if (row.colors) row.colors = JSON.parse(row.colors); } catch (e) { row.colors = null; }
      res.json(row);
    }
  );
});

// Create a tribe
app.post('/api/tribes', authenticateToken, (req, res) => {
  const { name, main_map, description, flag_image, colors } = req.body || {};
  if (!name) return res.status(400).json({ error: 'Missing tribe name' });
  const colorsStr = colors ? JSON.stringify(colors) : null;
  db.run('INSERT INTO tribes (name, main_map, description, flag_image, colors, owner_user_id) VALUES (?, ?, ?, ?, ?, ?)',
    [name, main_map || null, description || null, flag_image || null, colorsStr, req.user.userId], function(err) {
    if (err) return res.status(500).json({ error: 'Failed to create tribe' });
    const tribeId = this.lastID;
    db.run('INSERT INTO tribe_memberships (tribe_id, user_id, role) VALUES (?, ?, ?)', [tribeId, req.user.userId, 'owner']);
    logActivity(req.user.userId, 'tribe_created', { tribe_id: tribeId, tribe_name: name });
    res.status(201).json({ success: true, id: tribeId });
  });
});

// Update tribe settings (owner only)
app.put('/api/tribes/:id', authenticateToken, (req, res) => {
  const tribeId = req.params.id;
  const { name, main_map, description, flag_image, colors } = req.body || {};
  if (!name) return res.status(400).json({ error: 'Missing tribe name' });
  db.get('SELECT role FROM tribe_memberships WHERE tribe_id = ? AND user_id = ?', [tribeId, req.user.userId], (err, me) => {
    if (err || !me || me.role !== 'owner') return res.status(403).json({ error: 'Only owner can update tribe settings' });
    const colorsStr = colors ? JSON.stringify(colors) : null;
    db.run('UPDATE tribes SET name = ?, main_map = ?, description = ?, flag_image = ?, colors = ? WHERE id = ?',
      [name, main_map || null, description || null, flag_image || null, colorsStr, tribeId], function(err) {
      if (err) return res.status(500).json({ error: 'Failed to update tribe' });
      res.json({ success: true });
    });
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
  db.get('SELECT id, name, main_map, description, flag_image, colors, owner_user_id, created_at FROM tribes WHERE id = ?', [id], (err, tribe) => {
    if (err || !tribe) return res.status(404).json({ error: 'Tribe not found' });
    try { if (tribe.colors) tribe.colors = JSON.parse(tribe.colors); } catch (e) { tribe.colors = null; }
    db.all('SELECT m.id, m.user_id, m.role, u.nickname, u.email FROM tribe_memberships m LEFT JOIN users u ON m.user_id = u.id WHERE m.tribe_id = ?', [id], (err2, members) => {
      if (err2) return res.status(500).json({ error: 'Failed to load members' });
      res.json({ ...tribe, members: members || [] });
    });
  });
});

// Change a member's role (owner can set any; admin can set recruit/member only)
app.put('/api/tribes/:id/members/:userId/role', authenticateToken, (req, res) => {
  const tribeId = req.params.id;
  const targetId = req.params.userId;
  const { role } = req.body || {};
  const valid = ['recruit', 'member', 'admin'];
  if (!valid.includes(role)) return res.status(400).json({ error: 'Invalid role. Must be recruit, member, or admin.' });
  db.get('SELECT role FROM tribe_memberships WHERE tribe_id = ? AND user_id = ?', [tribeId, req.user.userId], (err, me) => {
    if (err || !me) return res.status(403).json({ error: 'Not a tribe member' });
    if (!(me.role === 'owner' || me.role === 'admin')) return res.status(403).json({ error: 'Insufficient role' });
    if (role === 'admin' && me.role !== 'owner') return res.status(403).json({ error: 'Only owner can promote to admin' });
    db.get('SELECT role FROM tribe_memberships WHERE tribe_id = ? AND user_id = ?', [tribeId, targetId], (err2, target) => {
      if (err2 || !target) return res.status(404).json({ error: 'Target member not found' });
      if (target.role === 'owner') return res.status(400).json({ error: 'Cannot change owner role' });
      db.run('UPDATE tribe_memberships SET role = ? WHERE tribe_id = ? AND user_id = ?', [role, tribeId, targetId], function(err3) {
        if (err3) return res.status(500).json({ error: 'Failed to update role' });
        res.json({ success: true });
      });
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
          db.run('INSERT INTO tribe_memberships (tribe_id, user_id, role) VALUES (?, ?, ?)', [jr.tribe_id, jr.user_id, targetRole || 'recruit']);
          logActivity(jr.user_id, 'tribe_joined', { tribe_id: jr.tribe_id });
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

// Notifications: list for authenticated user, includes actor nickname
app.get('/api/notifications', authenticateToken, (req, res) => {
  db.all(`
    SELECT n.id, n.actor_user_id, n.type, n.payload, n.read, n.created_at,
           u.nickname AS actor_nickname, u.email AS actor_email
    FROM notifications n
    LEFT JOIN users u ON n.actor_user_id = u.id
    WHERE n.user_id = ?
    ORDER BY n.created_at DESC
    LIMIT 50
  `, [req.user.userId], (err, rows) => {
    if (err) return res.status(500).json({ error: 'Failed to load notifications' });
    try {
      const items = (rows || []).map(r => ({
        id: r.id,
        actor_user_id: r.actor_user_id,
        actor_name: r.actor_nickname || r.actor_email || 'Someone',
        type: r.type,
        payload: r.payload ? JSON.parse(r.payload) : {},
        read: !!r.read,
        created_at: r.created_at
      }));
      res.json(items);
    } catch (e) { res.status(500).json({ error: 'Failed to parse notifications' }); }
  });
});

// Mark a single notification as read
app.put('/api/notifications/:id/read', authenticateToken, (req, res) => {
  const id = req.params.id;
  db.run('UPDATE notifications SET read = 1 WHERE id = ? AND user_id = ?', [id, req.user.userId], function(err) {
    if (err) return res.status(500).json({ error: 'Failed to mark read' });
    if (this.changes === 0) return res.status(404).json({ error: 'Not found or not owned' });
    res.json({ success: true });
  });
});

// Mark all notifications as read
app.put('/api/notifications/read-all', authenticateToken, (req, res) => {
  db.run('UPDATE notifications SET read = 1 WHERE user_id = ?', [req.user.userId], function(err) {
    if (err) return res.status(500).json({ error: 'Failed to mark all read' });
    res.json({ success: true, updated: this.changes });
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

// ── Arena collaborative session routes ───────────────────────────────────────

function arenaJoinCode() {
  const words = ['IRON','DARK','FIRE','STORM','FROST','BLOOD','WILD','SHADOW','STEEL','RAVEN'];
  return words[Math.floor(Math.random() * words.length)] + '-' + (1000 + Math.floor(Math.random() * 9000));
}

// Create a session
app.post('/api/arena/sessions', authenticateToken, (req, res) => {
  const { boss_id, boss_name, difficulty } = req.body || {};
  if (!boss_id) return res.status(400).json({ error: 'Missing boss_id' });
  const join_code = arenaJoinCode();
  db.run('INSERT INTO arena_sessions (boss_id, boss_name, creator_user_id, join_code, difficulty) VALUES (?, ?, ?, ?, ?)',
    [boss_id, boss_name || null, req.user.userId, join_code, difficulty || 'alpha'], function(err) {
    if (err) return res.status(500).json({ error: 'Failed to create session' });
    const sessionId = this.lastID;
    db.run('INSERT INTO arena_session_members (session_id, user_id) VALUES (?, ?)', [sessionId, req.user.userId]);
    res.status(201).json({ success: true, id: sessionId, join_code });
  });
});

// List sessions the user belongs to
app.get('/api/arena/sessions', authenticateToken, (req, res) => {
  db.all(`SELECT s.id, s.boss_id, s.boss_name, s.difficulty, s.status, s.join_code, s.created_at,
           s.creator_user_id, COUNT(DISTINCT m2.user_id) as member_count
          FROM arena_sessions s
          JOIN arena_session_members m ON s.id = m.session_id AND m.user_id = ?
          LEFT JOIN arena_session_members m2 ON s.id = m2.session_id
          GROUP BY s.id ORDER BY s.created_at DESC`,
    [req.user.userId], (err, rows) => {
    if (err) return res.status(500).json({ error: 'Failed to load sessions' });
    res.json(rows || []);
  });
});

// Get session details (members + creatures)
app.get('/api/arena/sessions/:id', authenticateToken, (req, res) => {
  const id = req.params.id;
  db.get('SELECT id FROM arena_session_members WHERE session_id = ? AND user_id = ?',
    [id, req.user.userId], (err, me) => {
    if (err || !me) return res.status(403).json({ error: 'Not a session member' });
    db.get('SELECT * FROM arena_sessions WHERE id = ?', [id], (err2, session) => {
      if (err2 || !session) return res.status(404).json({ error: 'Session not found' });
      db.all(`SELECT m.user_id, u.nickname, u.email FROM arena_session_members m
              LEFT JOIN users u ON m.user_id = u.id WHERE m.session_id = ?`, [id], (err3, members) => {
        db.all(`SELECT ac.id, ac.user_id, ac.creature_data, ac.added_at, u.nickname, u.email
                FROM arena_creatures ac LEFT JOIN users u ON ac.user_id = u.id
                WHERE ac.session_id = ?`, [id], (err4, creatures) => {
          const parsed = (creatures || []).map(c => ({
            id: c.id, user_id: c.user_id,
            owner: c.nickname || c.email || 'Unknown',
            added_at: c.added_at,
            creature: (() => { try { return JSON.parse(c.creature_data); } catch(e) { return {}; } })()
          }));
          res.json({ ...session, members: members || [], creatures: parsed });
        });
      });
    });
  });
});

// Join by code
app.post('/api/arena/sessions/join', authenticateToken, (req, res) => {
  const { join_code } = req.body || {};
  if (!join_code) return res.status(400).json({ error: 'Missing join code' });
  db.get("SELECT * FROM arena_sessions WHERE UPPER(join_code) = UPPER(?) AND status = 'open'",
    [join_code.trim()], (err, session) => {
    if (err || !session) return res.status(404).json({ error: 'Session not found or closed' });
    db.get('SELECT id FROM arena_session_members WHERE session_id = ? AND user_id = ?',
      [session.id, req.user.userId], (err2, existing) => {
      if (existing) return res.json({ success: true, id: session.id, already_member: true });
      db.run('INSERT INTO arena_session_members (session_id, user_id) VALUES (?, ?)',
        [session.id, req.user.userId], function(err3) {
        if (err3) return res.status(500).json({ error: 'Failed to join' });
        try {
          const p = JSON.stringify({ sessionId: session.id, bossName: session.boss_name || session.boss_id });
          db.run('INSERT INTO notifications (user_id, actor_user_id, type, payload, read) VALUES (?,?,?,?,0)',
            [session.creator_user_id, req.user.userId, 'arena_join', p]);
        } catch(e) {}
        res.json({ success: true, id: session.id });
      });
    });
  });
});

// Invite a user (adds them + notifies)
app.post('/api/arena/sessions/:id/invite', authenticateToken, (req, res) => {
  const sessionId = req.params.id;
  const { user_id } = req.body || {};
  if (!user_id) return res.status(400).json({ error: 'Missing user_id' });
  db.get('SELECT id FROM arena_session_members WHERE session_id = ? AND user_id = ?',
    [sessionId, req.user.userId], (err, me) => {
    if (err || !me) return res.status(403).json({ error: 'Not a member' });
    db.get('SELECT * FROM arena_sessions WHERE id = ?', [sessionId], (err2, session) => {
      if (!session) return res.status(404).json({ error: 'Not found' });
      db.get('SELECT id FROM arena_session_members WHERE session_id = ? AND user_id = ?',
        [sessionId, user_id], (err3, exists) => {
        if (exists) return res.status(400).json({ error: 'Already a member' });
        db.run('INSERT INTO arena_session_members (session_id, user_id) VALUES (?, ?)',
          [sessionId, user_id], function(err4) {
          if (err4) return res.status(500).json({ error: 'Failed to invite' });
          try {
            const p = JSON.stringify({ sessionId, bossName: session.boss_name || session.boss_id, join_code: session.join_code });
            db.run('INSERT INTO notifications (user_id, actor_user_id, type, payload, read) VALUES (?,?,?,?,0)',
              [user_id, req.user.userId, 'arena_invite', p]);
          } catch(e) {}
          res.json({ success: true });
        });
      });
    });
  });
});

// Close session (creator only)
app.put('/api/arena/sessions/:id/close', authenticateToken, (req, res) => {
  db.run("UPDATE arena_sessions SET status = 'closed' WHERE id = ? AND creator_user_id = ?",
    [req.params.id, req.user.userId], function(err) {
    if (err) return res.status(500).json({ error: 'Failed to close' });
    if (this.changes === 0) return res.status(403).json({ error: 'Not the creator or already closed' });
    res.json({ success: true });
  });
});

// Add a creature to the session roster
app.post('/api/arena/sessions/:id/creatures', authenticateToken, (req, res) => {
  const sessionId = req.params.id;
  const { creature_data } = req.body || {};
  if (!creature_data) return res.status(400).json({ error: 'Missing creature_data' });
  db.get('SELECT id FROM arena_session_members WHERE session_id = ? AND user_id = ?',
    [sessionId, req.user.userId], (err, me) => {
    if (err || !me) return res.status(403).json({ error: 'Not a member' });
    db.run('INSERT INTO arena_creatures (session_id, user_id, creature_data) VALUES (?, ?, ?)',
      [sessionId, req.user.userId, JSON.stringify(creature_data)], function(err2) {
      if (err2) return res.status(500).json({ error: 'Failed to add creature' });
      res.status(201).json({ success: true, id: this.lastID });
    });
  });
});

// Remove your creature from the session
app.delete('/api/arena/sessions/:id/creatures/:cid', authenticateToken, (req, res) => {
  db.run('DELETE FROM arena_creatures WHERE id = ? AND session_id = ? AND user_id = ?',
    [req.params.cid, req.params.id, req.user.userId], function(err) {
    if (err) return res.status(500).json({ error: 'Failed to remove' });
    if (this.changes === 0) return res.status(404).json({ error: 'Not found or not yours' });
    res.json({ success: true });
  });
});

// Send a chat message (text or creature share)
app.post('/api/arena/sessions/:id/chat', authenticateToken, (req, res) => {
  const sessionId = req.params.id;
  const { message_type, content } = req.body || {};
  if (!content) return res.status(400).json({ error: 'Missing content' });
  db.get('SELECT id FROM arena_session_members WHERE session_id = ? AND user_id = ?',
    [sessionId, req.user.userId], (err, me) => {
    if (err || !me) return res.status(403).json({ error: 'Not a member' });
    const type = message_type === 'creature' ? 'creature' : 'text';
    const str = type === 'creature' ? JSON.stringify(content) : String(content).slice(0, 1000);
    db.run('INSERT INTO arena_chat (session_id, user_id, message_type, content) VALUES (?, ?, ?, ?)',
      [sessionId, req.user.userId, type, str], function(err2) {
      if (err2) return res.status(500).json({ error: 'Failed to send' });
      res.status(201).json({ success: true, id: this.lastID });
    });
  });
});

// Get chat messages (supports ?since=lastId for polling)
app.get('/api/arena/sessions/:id/chat', authenticateToken, (req, res) => {
  const sessionId = req.params.id;
  const since = parseInt(req.query.since) || 0;
  db.get('SELECT id FROM arena_session_members WHERE session_id = ? AND user_id = ?',
    [sessionId, req.user.userId], (err, me) => {
    if (err || !me) return res.status(403).json({ error: 'Not a member' });
    db.all(`SELECT c.id, c.user_id, c.message_type, c.content, c.created_at,
            u.nickname, u.email FROM arena_chat c
            LEFT JOIN users u ON c.user_id = u.id
            WHERE c.session_id = ? AND c.id > ?
            ORDER BY c.created_at ASC LIMIT 100`,
      [sessionId, since], (err2, rows) => {
      if (err2) return res.status(500).json({ error: 'Failed to load chat' });
      const messages = (rows || []).map(r => ({
        id: r.id, user_id: r.user_id,
        sender: r.nickname || r.email || 'Unknown',
        message_type: r.message_type,
        content: r.message_type === 'creature'
          ? (() => { try { return JSON.parse(r.content); } catch(e) { return {}; } })()
          : r.content,
        created_at: r.created_at
      }));
      res.json(messages);
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
