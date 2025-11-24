const express = require('express');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const cors = require('cors');
const sqlite3 = require('sqlite3').verbose();

const app = express();
const PORT = 3001;

// Define JWT_SECRET directly here
const JWT_SECRET = 'your-super-secret-jwt-key-change-in-production-2024';

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Initialize database
const db = new sqlite3.Database('./auth.db', (err) => {
  if (err) {
    console.error('Database connection error:', err);
  } else {
    console.log('✓ Connected to auth database');
  }
});

// Login endpoint
app.post('/api/auth/login', (req, res) => {
  console.log('Login attempt for:', req.body.username);
  
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password required' });
  }

  db.get('SELECT * FROM users WHERE username = ?', [username], (err, user) => {
    if (err) {
      console.error('Database error:', err);
      return res.status(500).json({ error: 'Database error' });
    }
    
    if (!user) {
      console.log('User not found:', username);
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    if (!bcrypt.compareSync(password, user.password)) {
      console.log('Invalid password for:', username);
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    console.log('Creating JWT token with secret...');
    
    const token = jwt.sign(
      { userId: user.id, username: user.username, role: user.role },
      JWT_SECRET,  // Using the constant defined above
      { expiresIn: '24h' }
    );

    console.log('✓ Login successful:', username);

    res.json({
      token,
      user: {
        userId: user.id,
        username: user.username,
        role: user.role
      }
    });
  });
});

// Verify token endpoint
app.post('/api/auth/verify', (req, res) => {
  const { token } = req.body;

  if (!token) {
    return res.status(401).json({ valid: false, error: 'No token provided' });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    res.json({ valid: true, user: decoded });
  } catch (error) {
    res.status(401).json({ valid: false, error: 'Invalid token' });
  }
});

// Register new user (admin only - but we'll check role in frontend)
app.post('/api/auth/register', (req, res) => {
  console.log('Registration attempt:', req.body.username);
  
  const { username, password, email, role } = req.body;

  if (!username || !password || !role) {
    return res.status(400).json({ error: 'Username, password, and role are required' });
  }

  // Hash the password
  const hashedPassword = bcrypt.hashSync(password, 10);

  db.run(
    'INSERT INTO users (username, password, role, email) VALUES (?, ?, ?, ?)',
    [username, hashedPassword, role, email],
    function(err) {
      if (err) {
        console.error('Registration error:', err);
        return res.status(400).json({ error: 'Username already exists or database error' });
      }
      
      console.log('✓ User registered:', username);
      res.json({ 
        message: 'User registered successfully', 
        userId: this.lastID,
        user: { username, role, email }
      });
    }
  );
});

// Get all users (admin only)
app.get('/api/auth/users', (req, res) => {
  db.all('SELECT id, username, role, email, createdAt FROM users ORDER BY id', (err, users) => {
    if (err) {
      return res.status(500).json({ error: 'Failed to fetch users' });
    }
    res.json(users);
  });
});

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'auth', port: PORT });
});

app.listen(PORT, () => {
  console.log('========================================');
  console.log(`✓ Auth service running on port ${PORT}`);
  console.log(`✓ Test at: http://localhost:${PORT}/health`);
  console.log('========================================');
});