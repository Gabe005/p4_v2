const grpc = require('@grpc/grpc-js');
const protoLoader = require('@grpc/proto-loader');
const path = require('path');
const db = require('./database');

const PROTO_PATH = path.join(__dirname, '../protos/courses.proto');
const packageDefinition = protoLoader.loadSync(PROTO_PATH, {
  keepCase: true,
  longs: String,
  enums: String,
  defaults: true,
  oneofs: true
});

const coursesProto = grpc.loadPackageDefinition(packageDefinition).courses;

const courseService = {
  GetAllCourses: (call, callback) => {
    console.log('[gRPC] Get all courses request');
    
    db.all('SELECT * FROM courses ORDER BY code', (err, courses) => {
      if (err) {
        console.error('[gRPC] Error:', err);
        return callback(null, { courses: [] });
      }

      const courseList = courses.map(c => ({
        id: c.id,
        code: c.code,
        name: c.name,
        description: c.description || '',
        availableSlots: c.availableSlots
      }));

      callback(null, { courses: courseList });
    });
  },

  GetEnrolledCourses: (call, callback) => {
    const { userId } = call.request;
    console.log('[gRPC] Get enrolled courses for user:', userId);

    db.all(
      `SELECT c.* FROM courses c 
       JOIN enrollments e ON c.id = e.courseId 
       WHERE e.userId = ?`,
      [userId],
      (err, courses) => {
        if (err) {
          return callback(null, { courses: [] });
        }

        const courseList = courses.map(c => ({
          id: c.id,
          code: c.code,
          name: c.name,
          description: c.description || '',
          availableSlots: c.availableSlots
        }));

        callback(null, { courses: courseList });
      }
    );
  },

  EnrollInCourse: (call, callback) => {
    const { userId, courseId } = call.request;
    console.log('[gRPC] Enroll request - User:', userId, 'Course:', courseId);

    db.get('SELECT availableSlots FROM courses WHERE id = ?', [courseId], (err, course) => {
      if (err || !course) {
        return callback(null, {
          success: false,
          message: 'Course not found'
        });
      }

      if (course.availableSlots <= 0) {
        return callback(null, {
          success: false,
          message: 'No available slots'
        });
      }

      db.run(
        'INSERT INTO enrollments (userId, courseId) VALUES (?, ?)',
        [userId, courseId],
        function(err) {
          if (err) {
            return callback(null, {
              success: false,
              message: 'Already enrolled or error occurred'
            });
          }

          db.run('UPDATE courses SET availableSlots = availableSlots - 1 WHERE id = ?', [courseId]);

          console.log('[gRPC] ✓ Enrollment successful');
          callback(null, {
            success: true,
            message: 'Enrolled successfully',
            enrollmentId: this.lastID
          });
        }
      );
    });
  },

  DropCourse: (call, callback) => {
    const { userId, courseId } = call.request;
    console.log('[gRPC] Drop course - User:', userId, 'Course:', courseId);

    db.get(
      'SELECT * FROM enrollments WHERE userId = ? AND courseId = ?',
      [userId, courseId],
      (err, enrollment) => {
        if (err || !enrollment) {
          return callback(null, {
            success: false,
            message: 'Enrollment not found'
          });
        }

        db.run(
          'DELETE FROM enrollments WHERE userId = ? AND courseId = ?',
          [userId, courseId],
          function(err) {
            if (err) {
              return callback(null, {
                success: false,
                message: 'Failed to drop course'
              });
            }

            db.run('UPDATE courses SET availableSlots = availableSlots + 1 WHERE id = ?', [courseId]);

            console.log('[gRPC] ✓ Course dropped');
            callback(null, {
              success: true,
              message: 'Course dropped successfully'
            });
          }
        );
      }
    );
  },

  DropStudent: (call, callback) => {
    const { studentId, courseId, facultyId } = call.request;
    console.log('[gRPC] Drop student - Faculty:', facultyId, 'Student:', studentId, 'Course:', courseId);

    db.get(
      'SELECT * FROM enrollments WHERE userId = ? AND courseId = ?',
      [studentId, courseId],
      (err, enrollment) => {
        if (err || !enrollment) {
          return callback(null, {
            success: false,
            message: 'Student not enrolled in this course'
          });
        }

        db.run(
          'DELETE FROM enrollments WHERE userId = ? AND courseId = ?',
          [studentId, courseId],
          function(err) {
            if (err) {
              return callback(null, {
                success: false,
                message: 'Failed to drop student'
              });
            }

            db.run('UPDATE courses SET availableSlots = availableSlots + 1 WHERE id = ?', [courseId]);

            console.log('[gRPC] ✓ Student dropped');
            callback(null, {
              success: true,
              message: 'Student dropped from course successfully'
            });
          }
        );
      }
    );
  },

  AddCourse: (call, callback) => {
    const { code, name, description, availableSlots } = call.request;
    console.log('[gRPC] Add course:', code);

    if (!code || !name) {
      return callback(null, {
        success: false,
        message: 'Course code and name are required'
      });
    }

    db.run(
      'INSERT INTO courses (code, name, description, availableSlots) VALUES (?, ?, ?, ?)',
      [code, name, description || '', availableSlots || 30],
      function(err) {
        if (err) {
          return callback(null, {
            success: false,
            message: 'Course code already exists or database error'
          });
        }

        console.log('[gRPC] ✓ Course added:', code);
        callback(null, {
          success: true,
          message: 'Course added successfully',
          courseId: this.lastID
        });
      }
    );
  },

  DeleteCourse: (call, callback) => {
    const { courseId } = call.request;
    console.log('[gRPC] Delete course:', courseId);

    db.run('DELETE FROM enrollments WHERE courseId = ?', [courseId], (err) => {
      if (err) {
        return callback(null, {
          success: false,
          message: 'Failed to delete enrollments'
        });
      }

      db.run('DELETE FROM courses WHERE id = ?', [courseId], function(err) {
        if (err) {
          return callback(null, {
            success: false,
            message: 'Failed to delete course'
          });
        }

        console.log('[gRPC] ✓ Course deleted');
        callback(null, {
          success: true,
          message: 'Course deleted successfully'
        });
      });
    });
  },

  GetCourseStudents: (call, callback) => {
    const { courseId } = call.request;
    console.log('[gRPC] Get students for course:', courseId);

    db.all(
      `SELECT userId, enrolledAt FROM enrollments WHERE courseId = ? ORDER BY enrolledAt`,
      [courseId],
      (err, enrollments) => {
        if (err) {
          return callback(null, { students: [] });
        }

        const studentList = enrollments.map(e => ({
          userId: e.userId,
          enrolledAt: e.enrolledAt || ''
        }));

        callback(null, { students: studentList });
      }
    );
  }
};

function startGrpcServer() {
  const server = new grpc.Server();
  
  server.addService(coursesProto.CourseService.service, courseService);
  
  const GRPC_PORT = '50052';
  server.bindAsync(
    `0.0.0.0:${GRPC_PORT}`,
    grpc.ServerCredentials.createInsecure(),
    (err, port) => {
      if (err) {
        console.error('[gRPC] Failed to start server:', err);
        return;
      }
      console.log('========================================');
      console.log(`[gRPC] Course service running on port ${GRPC_PORT}`);
      console.log('========================================');
    }
  );
}

module.exports = { startGrpcServer };