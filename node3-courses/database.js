const sqlite3 = require('sqlite3').verbose();

const db = new sqlite3.Database('./courses.db');

db.serialize(() => {
  db.run(`CREATE TABLE IF NOT EXISTS courses (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    code TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    availableSlots INTEGER DEFAULT 30,
    createdAt DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS enrollments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    userId INTEGER NOT NULL,
    courseId INTEGER NOT NULL,
    enrolledAt DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(userId, courseId)
  )`);

  // Insert sample courses
  db.run(`INSERT OR IGNORE INTO courses (code, name, description, availableSlots) VALUES 
    ('CCPROG1', 'Introduction to Programming', 'Learn the basics of programming with Python', 30),
    ('CSOPESY', 'Operating Systems', 'Study Operating Systems', 25),
    ('STDISCM', 'Distributed Computing', 'Introduction to Distributed Computing', 40),
    ('PEDFOUR', 'Physical Education', 'Play Football', 35),
    ('LCFILIA', 'Fillipno', 'Learn about Philippine literature', 30)
  `);
});

module.exports = db;