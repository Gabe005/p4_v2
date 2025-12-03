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
  const password = bcrypt.hashSync('pass12345', 10);
  
  db.run(`INSERT OR IGNORE INTO users (id, username, password, role, email) VALUES 
    (1, 'Gabriele', ?, 'student', 'Gabe@gmail.com'),
    (2, 'Jack', ?, 'student', 'Jack@gmail.com'),
    (3, 'Jonathan', ?, 'faculty', 'JM@gmail.com'),
    (4, 'Admin', ?, 'admin', 'admin@gmail.com')
  `, [password, password, password, password]);
});

module.exports = db;