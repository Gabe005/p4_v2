const express = require('express');
const cors = require('cors');
const sqlite3 = require('sqlite3').verbose();

const { startGrpcServer } = require('./grpc-server');

const app = express();
const PORT = 3002;

app.use(cors());
app.use(express.json());

// Initialize database
const db = new sqlite3.Database('./courses.db', (err) => {
  if (err) {
    console.error('Database connection error:', err);
  } else {
    console.log('✓ Connected to courses database');
    initDatabase();
  }
});

function initDatabase() {
  db.run(`CREATE TABLE IF NOT EXISTS courses (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    code TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    availableSlots INTEGER DEFAULT 30,
    createdAt DATETIME DEFAULT CURRENT_TIMESTAMP
  )`, (err) => {
    if (err) {
      console.error('Error creating courses table:', err);
      return;
    }
    console.log('✓ Courses table ready');
  });

  db.run(`CREATE TABLE IF NOT EXISTS enrollments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    userId INTEGER NOT NULL,
    courseId INTEGER NOT NULL,
    enrolledAt DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(userId, courseId)
  )`, (err) => {
    if (err) {
      console.error('Error creating enrollments table:', err);
      return;
    }
    console.log('✓ Enrollments table ready');
  });

  // Check if we need sample data
  db.get('SELECT COUNT(*) as count FROM courses', (err, row) => {
    if (!err && row.count === 0) {
      console.log('Adding sample courses...');
      const courses = [
        ['CS101', 'Introduction to Programming', 'Learn the basics of programming with Python', 30],
        ['CS102', 'Data Structures', 'Study fundamental data structures and algorithms', 25],
        ['MATH201', 'Calculus I', 'Introduction to differential calculus', 40],
        ['ENG101', 'English Composition', 'Develop writing and communication skills', 35],
        ['PHY101', 'Physics I', 'Classical mechanics and thermodynamics', 30]
      ];

      const stmt = db.prepare('INSERT INTO courses (code, name, description, availableSlots) VALUES (?, ?, ?, ?)');
      courses.forEach(course => {
        stmt.run(course, (err) => {
          if (!err) console.log('✓ Added course:', course[0]);
        });
      });
      stmt.finalize();
    }
  });
}

// Get all courses
app.get('/api/courses', (req, res) => {
  db.all('SELECT * FROM courses ORDER BY code', (err, courses) => {
    if (err) {
      return res.status(500).json({ error: 'Failed to fetch courses' });
    }
    res.json(courses);
  });
});

// Get enrolled courses for a user
app.get('/api/courses/enrolled/:userId', (req, res) => {
  const { userId } = req.params;

  db.all(
    `SELECT c.* FROM courses c 
     JOIN enrollments e ON c.id = e.courseId 
     WHERE e.userId = ?`,
    [userId],
    (err, courses) => {
      if (err) {
        return res.status(500).json({ error: 'Failed to fetch enrolled courses' });
      }
      res.json(courses);
    }
  );
});

// Enroll in a course
app.post('/api/courses/enroll', (req, res) => {
  const { userId, courseId } = req.body;

  db.get('SELECT availableSlots FROM courses WHERE id = ?', [courseId], (err, course) => {
    if (err || !course) {
      return res.status(404).json({ error: 'Course not found' });
    }

    if (course.availableSlots <= 0) {
      return res.status(400).json({ error: 'No available slots' });
    }

    db.run(
      'INSERT INTO enrollments (userId, courseId) VALUES (?, ?)',
      [userId, courseId],
      function(err) {
        if (err) {
          return res.status(400).json({ error: 'Already enrolled or error occurred' });
        }

        db.run('UPDATE courses SET availableSlots = availableSlots - 1 WHERE id = ?', [courseId]);

        res.json({ message: 'Enrolled successfully', enrollmentId: this.lastID });
      }
    );
  });
});

app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'courses' });
});

// Add new course (admin/faculty only)
app.post('/api/courses/add', (req, res) => {
  const { code, name, description, availableSlots } = req.body;

  if (!code || !name) {
    return res.status(400).json({ error: 'Course code and name are required' });
  }

  db.run(
    'INSERT INTO courses (code, name, description, availableSlots) VALUES (?, ?, ?, ?)',
    [code, name, description || '', availableSlots || 30],
    function(err) {
      if (err) {
        console.error('Error adding course:', err);
        return res.status(400).json({ error: 'Course code already exists or database error' });
      }
      
      console.log('✓ Course added:', code);
      res.json({ 
        message: 'Course added successfully', 
        courseId: this.lastID,
        course: { code, name, description, availableSlots }
      });
    }
  );
});

// Drop/unenroll from a course (student dropping their own course)
app.post('/api/courses/drop', (req, res) => {
  const { userId, courseId } = req.body;

  if (!userId || !courseId) {
    return res.status(400).json({ error: 'User ID and Course ID are required' });
  }

  // Check if enrollment exists
  db.get(
    'SELECT * FROM enrollments WHERE userId = ? AND courseId = ?',
    [userId, courseId],
    (err, enrollment) => {
      if (err) {
        return res.status(500).json({ error: 'Database error' });
      }

      if (!enrollment) {
        return res.status(404).json({ error: 'Enrollment not found' });
      }

      // Delete enrollment
      db.run(
        'DELETE FROM enrollments WHERE userId = ? AND courseId = ?',
        [userId, courseId],
        function(err) {
          if (err) {
            return res.status(500).json({ error: 'Failed to drop course' });
          }

          // Increase available slots
          db.run(
            'UPDATE courses SET availableSlots = availableSlots + 1 WHERE id = ?',
            [courseId],
            (err) => {
              if (err) {
                console.error('Error updating slots:', err);
              }
            }
          );

          console.log(`✓ User ${userId} dropped course ${courseId}`);
          res.json({ message: 'Course dropped successfully' });
        }
      );
    }
  );
});

// Faculty drop student from course
app.post('/api/courses/drop-student', (req, res) => {
  const { studentId, courseId, facultyId } = req.body;

  if (!studentId || !courseId) {
    return res.status(400).json({ error: 'Student ID and Course ID are required' });
  }

  // Check if enrollment exists
  db.get(
    'SELECT * FROM enrollments WHERE userId = ? AND courseId = ?',
    [studentId, courseId],
    (err, enrollment) => {
      if (err) {
        return res.status(500).json({ error: 'Database error' });
      }

      if (!enrollment) {
        return res.status(404).json({ error: 'Student not enrolled in this course' });
      }

      // Delete enrollment
      db.run(
        'DELETE FROM enrollments WHERE userId = ? AND courseId = ?',
        [studentId, courseId],
        function(err) {
          if (err) {
            return res.status(500).json({ error: 'Failed to drop student' });
          }

          // Increase available slots
          db.run(
            'UPDATE courses SET availableSlots = availableSlots + 1 WHERE id = ?',
            [courseId]
          );

          console.log(`✓ Faculty ${facultyId} dropped student ${studentId} from course ${courseId}`);
          res.json({ message: 'Student dropped from course successfully' });
        }
      );
    }
  );
});

// Get students enrolled in a specific course (for faculty)
app.get('/api/courses/:courseId/students', (req, res) => {
  const { courseId } = req.params;

  db.all(
    `SELECT e.userId, e.enrolledAt 
     FROM enrollments e 
     WHERE e.courseId = ?
     ORDER BY e.enrolledAt`,
    [courseId],
    (err, enrollments) => {
      if (err) {
        return res.status(500).json({ error: 'Failed to fetch students' });
      }
      res.json(enrollments);
    }
  );
});

// Delete a course (admin only)
app.delete('/api/courses/:courseId', (req, res) => {
  const { courseId } = req.params;

  // First delete all enrollments
  db.run('DELETE FROM enrollments WHERE courseId = ?', [courseId], (err) => {
    if (err) {
      return res.status(500).json({ error: 'Failed to delete enrollments' });
    }

    // Then delete the course
    db.run('DELETE FROM courses WHERE id = ?', [courseId], function(err) {
      if (err) {
        return res.status(500).json({ error: 'Failed to delete course' });
      }

      console.log(`✓ Course ${courseId} deleted`);
      res.json({ message: 'Course deleted successfully' });
    });
  });
});

startGrpcServer();

app.listen(PORT, () => {
  console.log('========================================');
  console.log(`✓ Course service running on port ${PORT}`);
  console.log('========================================');
});