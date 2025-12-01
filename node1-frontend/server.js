const express = require('express');
const cookieParser = require('cookie-parser');
const path = require('path');
const grpcClients = require('./grpc-clients');

const app = express();
const PORT = 3000;

// For VM deployment, update these to actual VM IPs
// For localhost testing, keep as localhost
const AUTH_SERVICE = 'http://localhost:3001';
const COURSE_SERVICE = 'http://localhost:3002';
const GRADE_SERVICE = 'http://localhost:3003';

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));

// Middleware to check authentication using gRPC
const authMiddleware = async (req, res, next) => {
  const token = req.cookies.token;
  if (!token) {
    return res.redirect('/login');
  }

  try {
    const response = await grpcClients.auth.verifyToken({ token });
    
    if (!response.valid) {
      res.clearCookie('token');
      return res.redirect('/login');
    }
    
    req.user = response.user;
    next();
  } catch (error) {
    console.error('[gRPC] Auth verification error:', error.message);
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

// Login using gRPC
app.post('/login', async (req, res) => {
  console.log('[gRPC] Login attempt:', req.body.username);
  
  try {
    const response = await grpcClients.auth.login({
      username: req.body.username,
      password: req.body.password
    });
    
    if (!response.success) {
      console.log('[gRPC] Login failed:', response.error);
      return res.render('login', { error: response.error || 'Invalid credentials' });
    }
    
    console.log('[gRPC] Login successful');
    res.cookie('token', response.token, { httpOnly: true });
    res.redirect('/dashboard');
  } catch (error) {
    console.error('[gRPC] Login error:', error.message);
    res.render('login', { error: 'Service unavailable. Please try again.' });
  }
});

app.get('/logout', (req, res) => {
  res.clearCookie('token');
  res.redirect('/login');
});

app.get('/dashboard', authMiddleware, (req, res) => {
  res.render('dashboard', { user: req.user });
});

// Courses using gRPC
app.get('/courses', authMiddleware, async (req, res) => {
  try {
    const coursesResponse = await grpcClients.courses.getAllCourses({});
    const enrolledResponse = await grpcClients.courses.getEnrolledCourses({ 
      userId: req.user.userId 
    });
    
    res.render('courses', {
      user: req.user,
      courses: coursesResponse.courses || [],
      enrolled: enrolledResponse.courses || [],
      success: req.query.success,
      error: req.query.error
    });
  } catch (error) {
    console.error('[gRPC] Courses error:', error.message);
    res.render('courses', {
      user: req.user,
      courses: [],
      enrolled: [],
      error: 'Failed to load courses'
    });
  }
});

// Enroll using gRPC
app.post('/enroll', authMiddleware, async (req, res) => {
  try {
    const response = await grpcClients.courses.enrollInCourse({
      userId: req.user.userId,
      courseId: parseInt(req.body.courseId)
    });
    
    if (!response.success) {
      console.log('[gRPC] Enrollment failed:', response.message);
      return res.redirect('/courses?error=' + encodeURIComponent(response.message));
    }
    
    console.log('[gRPC] Enrollment successful');
    res.redirect('/courses?success=enrolled');
  } catch (error) {
    console.error('[gRPC] Enroll error:', error.message);
    res.redirect('/courses?error=enrollment_failed');
  }
});

// Drop course using gRPC
app.post('/drop-course', authMiddleware, async (req, res) => {
  if (req.user.role !== 'student') {
    return res.redirect('/dashboard');
  }

  try {
    const response = await grpcClients.courses.dropCourse({
      userId: req.user.userId,
      courseId: parseInt(req.body.courseId)
    });
    
    if (!response.success) {
      return res.redirect('/courses?error=' + encodeURIComponent(response.message));
    }
    
    console.log('[gRPC] Course dropped successfully');
    res.redirect('/courses?success=course_dropped');
  } catch (error) {
    console.error('[gRPC] Drop course error:', error.message);
    res.redirect('/courses?error=failed_to_drop_course');
  }
});

// Grades using gRPC
app.get('/grades', authMiddleware, async (req, res) => {
  if (req.user.role !== 'student') {
    return res.redirect('/dashboard');
  }

  try {
    const response = await grpcClients.grades.getStudentGrades({ 
      userId: req.user.userId 
    });
    
    res.render('grades', { 
      user: req.user, 
      grades: response.grades || [] 
    });
  } catch (error) {
    console.error('[gRPC] Grades error:', error.message);
    res.render('grades', { 
      user: req.user, 
      grades: [], 
      error: 'Failed to load grades' 
    });
  }
});

// Upload grades page
app.get('/upload-grades', authMiddleware, async (req, res) => {
  if (req.user.role !== 'faculty') {
    return res.redirect('/dashboard');
  }

  try {
    const coursesResponse = await grpcClients.courses.getAllCourses({});
    res.render('upload-grades', { 
      user: req.user, 
      courses: coursesResponse.courses || [],
      success: req.query.success,
      error: req.query.error
    });
  } catch (error) {
    console.error('[gRPC] Error loading courses:', error.message);
    res.render('upload-grades', { 
      user: req.user, 
      courses: [], 
      error: 'Failed to load courses' 
    });
  }
});

// Upload grade using gRPC
app.post('/upload-grades', authMiddleware, async (req, res) => {
  if (req.user.role !== 'faculty') {
    return res.redirect('/dashboard');
  }

  try {
    const response = await grpcClients.grades.uploadGrade({
      studentId: parseInt(req.body.studentId),
      courseId: parseInt(req.body.courseId),
      grade: req.body.grade,
      facultyId: req.user.userId
    });
    
    if (!response.success) {
      return res.redirect('/upload-grades?error=' + encodeURIComponent(response.message));
    }
    
    console.log('[gRPC] Grade uploaded successfully');
    res.redirect('/upload-grades?success=true');
  } catch (error) {
    console.error('[gRPC] Upload grade error:', error.message);
    res.redirect('/upload-grades?error=upload_failed');
  }
});

// Admin - Manage Users using gRPC
app.get('/manage-users', authMiddleware, async (req, res) => {
  if (req.user.role !== 'admin') {
    return res.redirect('/dashboard');
  }

  try {
    const response = await grpcClients.auth.getAllUsers({});
    res.render('manage-users', { 
      user: req.user, 
      users: response.users || [], 
      success: req.query.success, 
      error: req.query.error 
    });
  } catch (error) {
    console.error('[gRPC] Error loading users:', error.message);
    res.render('manage-users', { 
      user: req.user, 
      users: [], 
      error: 'Failed to load users' 
    });
  }
});

// Add user using gRPC
app.post('/add-user', authMiddleware, async (req, res) => {
  if (req.user.role !== 'admin') {
    return res.redirect('/dashboard');
  }

  try {
    const response = await grpcClients.auth.register({
      username: req.body.username,
      password: req.body.password,
      email: req.body.email || '',
      role: req.body.role
    });
    
    if (!response.success) {
      return res.redirect('/manage-users?error=' + encodeURIComponent(response.error));
    }
    
    console.log('[gRPC] User added successfully');
    res.redirect('/manage-users?success=user_added');
  } catch (error) {
    console.error('[gRPC] Add user error:', error.message);
    res.redirect('/manage-users?error=failed_to_add_user');
  }
});

// Admin - Manage Courses using gRPC
app.get('/manage-courses', authMiddleware, async (req, res) => {
  if (req.user.role !== 'admin') {
    return res.redirect('/dashboard');
  }

  try {
    const coursesResponse = await grpcClients.courses.getAllCourses({});
    res.render('manage-courses', { 
      user: req.user, 
      courses: coursesResponse.courses || [],
      success: req.query.success,
      error: req.query.error
    });
  } catch (error) {
    console.error('[gRPC] Error loading courses:', error.message);
    res.render('manage-courses', { 
      user: req.user, 
      courses: [], 
      error: 'Failed to load courses' 
    });
  }
});

// Add course using gRPC
app.post('/add-course', authMiddleware, async (req, res) => {
  if (req.user.role !== 'admin') {
    return res.redirect('/dashboard');
  }

  try {
    const response = await grpcClients.courses.addCourse({
      code: req.body.code,
      name: req.body.name,
      description: req.body.description || '',
      availableSlots: parseInt(req.body.availableSlots) || 30
    });
    
    if (!response.success) {
      return res.redirect('/manage-courses?error=' + encodeURIComponent(response.message));
    }
    
    console.log('[gRPC] Course added successfully');
    res.redirect('/manage-courses?success=course_added');
  } catch (error) {
    console.error('[gRPC] Add course error:', error.message);
    res.redirect('/manage-courses?error=failed_to_add_course');
  }
});

// Delete course using gRPC
app.post('/delete-course', authMiddleware, async (req, res) => {
  if (req.user.role !== 'admin') {
    return res.redirect('/dashboard');
  }

  try {
    const response = await grpcClients.courses.deleteCourse({
      courseId: parseInt(req.body.courseId)
    });
    
    if (!response.success) {
      return res.redirect('/manage-courses?error=' + encodeURIComponent(response.message));
    }
    
    console.log('[gRPC] Course deleted successfully');
    res.redirect('/manage-courses?success=course_deleted');
  } catch (error) {
    console.error('[gRPC] Delete course error:', error.message);
    res.redirect('/manage-courses?error=failed_to_delete_course');
  }
});

// Faculty - Manage Enrollments using gRPC
app.get('/manage-enrollments', authMiddleware, async (req, res) => {
  if (req.user.role !== 'faculty') {
    return res.redirect('/dashboard');
  }

  try {
    const coursesResponse = await grpcClients.courses.getAllCourses({});
    res.render('manage-enrollments', { 
      user: req.user, 
      courses: coursesResponse.courses || [],
      success: req.query.success,
      error: req.query.error
    });
  } catch (error) {
    console.error('[gRPC] Error loading courses:', error.message);
    res.render('manage-enrollments', { 
      user: req.user, 
      courses: [], 
      error: 'Failed to load courses' 
    });
  }
});

// Drop student using gRPC
app.post('/drop-student', authMiddleware, async (req, res) => {
  if (req.user.role !== 'faculty') {
    return res.redirect('/dashboard');
  }

  try {
    const response = await grpcClients.courses.dropStudent({
      studentId: parseInt(req.body.studentId),
      courseId: parseInt(req.body.courseId),
      facultyId: req.user.userId
    });
    
    if (!response.success) {
      return res.redirect('/manage-enrollments?error=' + encodeURIComponent(response.message));
    }
    
    console.log('[gRPC] Student dropped successfully');
    res.redirect('/manage-enrollments?success=student_dropped');
  } catch (error) {
    console.error('[gRPC] Drop student error:', error.message);
    res.redirect('/manage-enrollments?error=failed_to_drop_student');
  }
});

// Get students in course (AJAX endpoint for faculty)
app.get('/course-students/:courseId', authMiddleware, async (req, res) => {
  if (req.user.role !== 'faculty' && req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Unauthorized' });
  }

  try {
    const response = await grpcClients.courses.getCourseStudents({
      courseId: parseInt(req.params.courseId)
    });
    
    res.json(response.students || []);
  } catch (error) {
    console.error('[gRPC] Error loading course students:', error.message);
    res.status(500).json({ error: 'Failed to load students' });
  }
});

// Start server
app.listen(PORT, '0.0.0.0', () => {
  console.log('========================================');
  console.log(`✓ Frontend service running on port ${PORT}`);
  console.log(`✓ Access at: http://localhost:${PORT}`);
  console.log(`✓ Using gRPC for inter-service communication`);
  console.log('========================================');
});