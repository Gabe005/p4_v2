const grpc = require('@grpc/grpc-js');
const protoLoader = require('@grpc/proto-loader');
const path = require('path');

// Load proto files
const authProtoPath = path.join(__dirname, '../protos/auth.proto');
const coursesProtoPath = path.join(__dirname, '../protos/courses.proto');
const gradesProtoPath = path.join(__dirname, '../protos/grades.proto');

const packageDefinition = {
  keepCase: true,
  longs: String,
  enums: String,
  defaults: true,
  oneofs: true
};

// Load auth service
const authPackageDefinition = protoLoader.loadSync(authProtoPath, packageDefinition);
const authProto = grpc.loadPackageDefinition(authPackageDefinition).auth;
const authClient = new authProto.AuthService(
  'localhost:50051',
  grpc.credentials.createInsecure()
);

// Load course service
const coursesPackageDefinition = protoLoader.loadSync(coursesProtoPath, packageDefinition);
const coursesProto = grpc.loadPackageDefinition(coursesPackageDefinition).courses;
const coursesClient = new coursesProto.CourseService(
  'localhost:50052',
  grpc.credentials.createInsecure()
);

// Load grade service
const gradesPackageDefinition = protoLoader.loadSync(gradesProtoPath, packageDefinition);
const gradesProto = grpc.loadPackageDefinition(gradesPackageDefinition).grades;
const gradesClient = new gradesProto.GradeService(
  'localhost:50053',
  grpc.credentials.createInsecure()
);

// Promisify gRPC calls
function promisifyGrpcCall(client, method) {
  return (request) => {
    return new Promise((resolve, reject) => {
      client[method](request, (error, response) => {
        if (error) {
          reject(error);
        } else {
          resolve(response);
        }
      });
    });
  };
}

// Export promisified clients
module.exports = {
  auth: {
    login: promisifyGrpcCall(authClient, 'Login'),
    verifyToken: promisifyGrpcCall(authClient, 'VerifyToken'),
    register: promisifyGrpcCall(authClient, 'Register'),
    getAllUsers: promisifyGrpcCall(authClient, 'GetAllUsers')
  },
  courses: {
    getAllCourses: promisifyGrpcCall(coursesClient, 'GetAllCourses'),
    getEnrolledCourses: promisifyGrpcCall(coursesClient, 'GetEnrolledCourses'),
    enrollInCourse: promisifyGrpcCall(coursesClient, 'EnrollInCourse'),
    dropCourse: promisifyGrpcCall(coursesClient, 'DropCourse'),
    dropStudent: promisifyGrpcCall(coursesClient, 'DropStudent'),
    addCourse: promisifyGrpcCall(coursesClient, 'AddCourse'),
    deleteCourse: promisifyGrpcCall(coursesClient, 'DeleteCourse'),
    getCourseStudents: promisifyGrpcCall(coursesClient, 'GetCourseStudents')
  },
  grades: {
    getStudentGrades: promisifyGrpcCall(gradesClient, 'GetStudentGrades'),
    uploadGrade: promisifyGrpcCall(gradesClient, 'UploadGrade'),
    getCourseGrades: promisifyGrpcCall(gradesClient, 'GetCourseGrades')
  }
};