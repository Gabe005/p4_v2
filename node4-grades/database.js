const sqlite3 = require('sqlite3').verbose();

const db = new sqlite3.Database('./grades.db');

db.serialize(() => {
  db.run(`CREATE TABLE IF NOT EXISTS grades (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    studentId INTEGER NOT NULL,
    courseId INTEGER NOT NULL,
    grade TEXT NOT NULL,
    facultyId INTEGER NOT NULL,
    createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(studentId, courseId)
  )`);
});

module.exports = db;