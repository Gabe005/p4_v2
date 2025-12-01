const grpc = require('@grpc/grpc-js');
const protoLoader = require('@grpc/proto-loader');
const path = require('path');
const db = require('./database');

const PROTO_PATH = path.join(__dirname, '../protos/grades.proto');
const packageDefinition = protoLoader.loadSync(PROTO_PATH, {
  keepCase: true,
  longs: String,
  enums: String,
  defaults: true,
  oneofs: true
});

const gradesProto = grpc.loadPackageDefinition(packageDefinition).grades;

const gradeService = {
  GetStudentGrades: (call, callback) => {
    const { userId } = call.request;
    console.log('[gRPC] Get grades for student:', userId);

    db.all(
      `SELECT g.*, 
       'CS' || CAST(g.courseId AS TEXT) as courseCode,
       'Course ' || CAST(g.courseId AS TEXT) as courseName
       FROM grades g WHERE g.studentId = ?`,
      [userId],
      (err, grades) => {
        if (err) {
          return callback(null, { grades: [] });
        }

        const gradeList = grades.map(g => ({
          id: g.id,
          studentId: g.studentId,
          courseId: g.courseId,
          grade: g.grade,
          facultyId: g.facultyId,
          createdAt: g.createdAt || '',
          courseCode: g.courseCode,
          courseName: g.courseName
        }));

        callback(null, { grades: gradeList });
      }
    );
  },

  UploadGrade: (call, callback) => {
    const { studentId, courseId, grade, facultyId } = call.request;
    console.log('[gRPC] Upload grade - Faculty:', facultyId, 'Student:', studentId, 'Course:', courseId);

    db.run(
      `INSERT OR REPLACE INTO grades (studentId, courseId, grade, facultyId) 
       VALUES (?, ?, ?, ?)`,
      [studentId, courseId, grade, facultyId],
      function(err) {
        if (err) {
          return callback(null, {
            success: false,
            message: 'Failed to upload grade'
          });
        }

        console.log('[gRPC] ✓ Grade uploaded');
        callback(null, {
          success: true,
          message: 'Grade uploaded successfully',
          gradeId: this.lastID
        });
      }
    );
  },

  GetCourseGrades: (call, callback) => {
    const { courseId } = call.request;
    console.log('[gRPC] Get grades for course:', courseId);

    db.all(
      'SELECT * FROM grades WHERE courseId = ?',
      [courseId],
      (err, grades) => {
        if (err) {
          return callback(null, { grades: [] });
        }

        const gradeList = grades.map(g => ({
          id: g.id,
          studentId: g.studentId,
          courseId: g.courseId,
          grade: g.grade,
          facultyId: g.facultyId,
          createdAt: g.createdAt || '',
          courseCode: `CS${g.courseId}`,
          courseName: `Course ${g.courseId}`
        }));

        callback(null, { grades: gradeList });
      }
    );
  }
};

function startGrpcServer() {
  const server = new grpc.Server();
  
  server.addService(gradesProto.GradeService.service, gradeService);
  
  const GRPC_PORT = '50053';
  server.bindAsync(
    `0.0.0.0:${GRPC_PORT}`,
    grpc.ServerCredentials.createInsecure(),
    (err, port) => {
      if (err) {
        console.error('[gRPC] Failed to start server:', err);
        return;
      }
      console.log('========================================');
      console.log(`[gRPC] Grade service running on port ${GRPC_PORT}`);
      console.log('========================================');
    }
  );
}

module.exports = { startGrpcServer };