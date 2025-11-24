const express = require('express');
const cors = require('cors');
const sqlite3 = require('sqlite3').verbose();

const app = express();
const PORT = 3003;

app.use(cors());
app.use(express.json());

// Initialize database
const db = new sqlite3.Database('./grades.db', (err) => {
  if (err) {
    console.error('Database connection error:', err);
  } else {
    console.log('✓ Connected to grades database');
    initDatabase();
  }
});

function initDatabase() {
  db.run(`CREATE TABLE IF NOT EXISTS grades (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    studentId INTEGER NOT NULL,
    courseId INTEGER NOT NULL,
    grade TEXT NOT NULL,
    facultyId INTEGER NOT NULL,
    createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(studentId, courseId)
  )`, (err) => {
    if (err) {
      console.error('Error creating grades table:', err);
    } else {
      console.log('✓ Grades table ready');
    }
  });
}

// Get grades for a student
app.get('/api/grades/:userId', (req, res) => {
  const { userId } = req.params;

  db.all(
    `SELECT g.*, 
     'CS' || CAST(g.courseId AS TEXT) as courseCode,
     'Course ' || CAST(g.courseId AS TEXT) as courseName
     FROM grades g WHERE g.studentId = ?`,
    [userId],
    (err, grades) => {
      if (err) {
        return res.status(500).json({ error: 'Failed to fetch grades' });
      }
      res.json(grades);
    }
  );
});

// Upload grade
app.post('/api/grades/upload', (req, res) => {
  const { studentId, courseId, grade, facultyId } = req.body;

  db.run(
    `INSERT OR REPLACE INTO grades (studentId, courseId, grade, facultyId) 
     VALUES (?, ?, ?, ?)`,
    [studentId, courseId, grade, facultyId],
    function(err) {
      if (err) {
        return res.status(500).json({ error: 'Failed to upload grade' });
      }
      res.json({ message: 'Grade uploaded successfully', gradeId: this.lastID });
    }
  );
});

app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'grades' });
});

app.listen(PORT, () => {
  console.log('========================================');
  console.log(`✓ Grade service running on port ${PORT}`);
  console.log('========================================');
});