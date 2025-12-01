const express = require('express');
const axios = require('axios');
const cookieParser = require('cookie-parser');
const path = require('path');

const app = express();
const PORT = 3000;

// Hardcode service URLs
const AUTH_SERVICE = 'http://localhost:3001';
const COURSE_SERVICE = 'http://localhost:3002';
const GRADE_SERVICE = 'http://localhost:3003';

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));

// Middleware to check authentication
const authMiddleware = async (req, res, next) => {
  const token = req.cookies.token;
  if (!token) {
    return res.redirect('/login');
  }

  try {
    const response = await axios.post(`${AUTH_SERVICE}/api/auth/verify`, { token });
    req.user = response.data.user;
    next();
  } catch (error) {
    res.clearCookie('token');
    return res.redirect('/login');
  }
};

// Routes
app.get('/', (req, res) => {
  res.redirect('/login');
});

app.get('/login', (req, res) => {
  res.render('login', { error: null });
});

app.post('/login', async (req, res) => {
  console.log('Login attempt:', req.body.username);
  
  try {
    const response = await axios.post(`${AUTH_SERVICE}/api/auth/login`, req.body);
    console.log('Login successful');
    
    res.cookie('token', response.data.token, { httpOnly: true });
    res.redirect('/dashboard');
  } catch (error) {
    console.error('Login failed:', error.message);
    res.render('login', { error: 'Invalid credentials' });
  }
});

app.get('/logout', (req, res) => {
  res.clearCookie('token');
  res.redirect('/login');
});

app.get('/dashboard', authMiddleware, (req, res) => {
  res.render('dashboard', { user: req.user });
});

app.get('/courses', authMiddleware, async (req, res) => {
  try {
    const coursesResponse = await axios.get(`${COURSE_SERVICE}/api/courses`);
    const enrolledResponse = await axios.get(`${COURSE_SERVICE}/api/courses/enrolled/${req.user.userId}`);
    
    res.render('courses', {
      user: req.user,
      courses: coursesResponse.data,
      enrolled: enrolledResponse.data,
      success: req.query.success,
    });
  } catch (error) {
    res.render('courses', {
      user: req.user,
      courses: [],
      enrolled: [],
      error: req.query.success
    });
  }
});

app.post('/enroll', authMiddleware, async (req, res) => {
  try {
    await axios.post(`${COURSE_SERVICE}/api/courses/enroll`, {
      userId: req.user.userId,
      courseId: req.body.courseId
    });
    res.redirect('/courses');
  } catch (error) {
    res.redirect('/courses?error=enrollment_failed');
  }
});

app.get('/grades', authMiddleware, async (req, res) => {
  if (req.user.role !== 'student') {
    return res.redirect('/dashboard');
  }

  try {
    const response = await axios.get(`${GRADE_SERVICE}/api/grades/${req.user.userId}`);
    res.render('grades', { user: req.user, grades: response.data });
  } catch (error) {
    res.render('grades', { user: req.user, grades: [], error:req.query.success });
  }
});

app.get('/upload-grades', authMiddleware, async (req, res) => {
  if (req.user.role !== 'faculty') {
    return res.redirect('/dashboard');
  }

  try {
    const coursesResponse = await axios.get(`${COURSE_SERVICE}/api/courses`);
    res.render('upload-grades', { user: req.user, courses: coursesResponse.data });
  } catch (error) {
    res.render('upload-grades', { user: req.user, courses: [], error: req.query.success });
  }
});

app.post('/upload-grades', authMiddleware, async (req, res) => {
  if (req.user.role !== 'faculty') {
    return res.redirect('/dashboard');
  }

  try {
    await axios.post(`${GRADE_SERVICE}/api/grades/upload`, {
      studentId: req.body.studentId,
      courseId: req.body.courseId,
      grade: req.body.grade,
      facultyId: req.user.userId
    });
    res.redirect('/upload-grades?success=true');
  } catch (error) {
    res.redirect('/upload-grades?error=upload_failed');
  }
});

// Register new user (admin only)
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

// Admin - Manage Users
app.get('/manage-users', authMiddleware, async (req, res) => {
  if (req.user.role !== 'admin') {
    return res.redirect('/dashboard');
  }

  try {
    const response = await axios.get(`${AUTH_SERVICE}/api/auth/users`);
    res.render('manage-users', { user: req.user, users: response.data, success: req.query.success, error: req.query.error });
  } catch (error) {
    res.render('manage-users', { user: req.user, users: [], error: req.query.success });
  }
});

app.post('/add-user', authMiddleware, async (req, res) => {
  if (req.user.role !== 'admin') {
    return res.redirect('/dashboard');
  }

  try {
    await axios.post(`${AUTH_SERVICE}/api/auth/register`, req.body);
    res.redirect('/manage-users?success=user_added');
  } catch (error) {
    res.redirect('/manage-users?error=failed_to_add_user');
  }
});

// Admin - Manage Courses
app.get('/manage-courses', authMiddleware, async (req, res) => {
  if (req.user.role !== 'admin') {
    return res.redirect('/dashboard');
  }

  try {
    const coursesResponse = await axios.get(`${COURSE_SERVICE}/api/courses`);
    res.render('manage-courses', { 
      user: req.user, 
      courses: coursesResponse.data,
      success: req.query.success,
      error: req.query.error
    });
  } catch (error) {
    res.render('manage-courses', { user: req.user, courses: [],  error: req.query.error });
  }
});

app.post('/add-course', authMiddleware, async (req, res) => {
  if (req.user.role !== 'admin') {
    return res.redirect('/dashboard');
  }

  try {
    await axios.post(`${COURSE_SERVICE}/api/courses/add`, req.body);
    res.redirect('/manage-courses?success=course_added');
  } catch (error) {
    res.redirect('/manage-courses?error=failed_to_add_course');
  }
});

app.post('/delete-course', authMiddleware, async (req, res) => {
  if (req.user.role !== 'admin') {
    return res.redirect('/dashboard');
  }

  try {
    await axios.delete(`${COURSE_SERVICE}/api/courses/${req.body.courseId}`);
    res.redirect('/manage-courses?success=course_deleted');
  } catch (error) {
    res.redirect('/manage-courses?error=failed_to_delete_course');
  }
});

// Student - Drop Course
app.post('/drop-course', authMiddleware, async (req, res) => {
  if (req.user.role !== 'student') {
    return res.redirect('/dashboard');
  }

  try {
    await axios.post(`${COURSE_SERVICE}/api/courses/drop`, {
      userId: req.user.userId,
      courseId: req.body.courseId
    });
    res.redirect('/courses?success=course_dropped');
  } catch (error) {
    res.redirect('/courses?error=failed_to_drop_course');
  }
});

// Faculty - Manage Enrollments
app.get('/manage-enrollments', authMiddleware, async (req, res) => {
  if (req.user.role !== 'faculty') {
    return res.redirect('/dashboard');
  }

  try {
    const coursesResponse = await axios.get(`${COURSE_SERVICE}/api/courses`);
    res.render('manage-enrollments', { 
      user: req.user, 
      courses: coursesResponse.data,
      success: req.query.success,
      error: req.query.error
    });
  } catch (error) {
    res.render('manage-enrollments', { user: req.user, courses: [], error: 'Failed to load courses' });
  }
});

app.post('/drop-student', authMiddleware, async (req, res) => {
  if (req.user.role !== 'faculty') {
    return res.redirect('/dashboard');
  }

  try {
    await axios.post(`${COURSE_SERVICE}/api/courses/drop-student`, {
      studentId: req.body.studentId,
      courseId: req.body.courseId,
      facultyId: req.user.userId
    });
    res.redirect('/manage-enrollments?success=student_dropped');
  } catch (error) {
    res.redirect('/manage-enrollments?error=failed_to_drop_student');
  }
});

// Get students in a course
app.get('/course-students/:courseId', authMiddleware, async (req, res) => {
  if (req.user.role !== 'faculty' && req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Unauthorized' });
  }

  try {
    const enrollmentsResponse = await axios.get(
      `${COURSE_SERVICE}/api/courses/${req.params.courseId}/students`
    );
    res.json(enrollmentsResponse.data);
  } catch (error) {
    res.status(500).json({ error: 'Failed to load students' });
  }
});

app.listen(PORT, () => {
  console.log('========================================');
  console.log(`✓ Frontend service running on port ${PORT}`);
  console.log(`✓ Access at: http://localhost:${PORT}`);
  console.log('========================================');
});