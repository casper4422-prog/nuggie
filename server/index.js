// Entry point for the backend server
const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const rateLimit = require('express-rate-limit');

const app = express();
const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3001;
// Use environment variable for the JWT secret in production. Falling back to a default for dev.
const SECRET = process.env.JWT_SECRET || 'your_jwt_secret';
if (!process.env.JWT_SECRET) {
  console.warn('Warning: JWT_SECRET is not set. Using default development secret. Do NOT use this in production.');
}

app.use(cors());
app.use(bodyParser.json());

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
      // Create JWT for new user and return it so client can be immediately authenticated
      try {
        const userId = this.lastID;
        const token = jwt.sign({ userId }, SECRET, { expiresIn: '1d' });
        return res.json({ token });
      } catch (e) {
        return res.status(500).json({ error: 'Failed to create token' });
      }
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
        const token = jwt.sign({ userId: user.id }, SECRET, { expiresIn: '1d' });
        res.json({ token });
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

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
