const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcryptjs');

console.log('Creating fresh database...');

const db = new sqlite3.Database('./auth.db', (err) => {
  if (err) {
    console.error('Error creating database:', err);
    process.exit(1);
  }
  console.log('✓ Database file created');
});

db.serialize(() => {
  // Create table
  db.run(`CREATE TABLE users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    role TEXT NOT NULL,
    email TEXT,
    createdAt DATETIME DEFAULT CURRENT_TIMESTAMP
  )`, (err) => {
    if (err) {
      console.error('✗ Error creating table:', err);
      process.exit(1);
    }
    console.log('✓ Users table created');
  });

  // Add users
  const password = bcrypt.hashSync('password123', 10);
  console.log('✓ Password hashed');

  const stmt = db.prepare('INSERT INTO users (id, username, password, role, email) VALUES (?, ?, ?, ?, ?)');
  
  const users = [
    [1, 'student1', password, 'student', 'student1@example.com'],
    [2, 'student2', password, 'student', 'student2@example.com'],
    [3, 'faculty1', password, 'faculty', 'faculty1@example.com'],
    [4, 'admin1', password, 'admin', 'admin1@example.com']
  ];

  users.forEach(user => {
    stmt.run(user, (err) => {
      if (err) {
        console.error('✗ Error adding user:', user[1], err);
      } else {
        console.log('✓ Added user:', user[1]);
      }
    });
  });

  stmt.finalize();

  // Verify
  setTimeout(() => {
    db.all('SELECT id, username, role FROM users', (err, rows) => {
      if (err) {
        console.error('✗ Error reading users:', err);
      } else {
        console.log('\n✓ Database initialized successfully!');
        console.log('Users in database:');
        console.table(rows);
      }
      
      db.close(() => {
        console.log('\n✓ Done! Now run: node server.js');
      });
    });
  }, 500);
});