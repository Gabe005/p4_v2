const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcryptjs');

const db = new sqlite3.Database('./auth.db');

db.serialize(() => {
  db.run(`CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    role TEXT NOT NULL,
    email TEXT,
    createdAt DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  // Insert default users
  const password = bcrypt.hashSync('password123', 10);
  
  db.run(`INSERT OR IGNORE INTO users (id, username, password, role, email) VALUES 
    (1, 'student1', ?, 'student', 'student1@example.com'),
    (2, 'student2', ?, 'student', 'student2@example.com'),
    (3, 'faculty1', ?, 'faculty', 'faculty1@example.com'),
    (4, 'admin1', ?, 'admin', 'admin1@example.com')
  `, [password, password, password, password]);
});

module.exports = db;