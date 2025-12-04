const grpc = require('@grpc/grpc-js');
const protoLoader = require('@grpc/proto-loader');
const path = require('path');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const db = require('./database');

const JWT_SECRET = 'your-super-secret-jwt-key-change-in-production-2024';

// Load proto file
const PROTO_PATH = path.join(__dirname, '../protos/auth.proto');
const packageDefinition = protoLoader.loadSync(PROTO_PATH, {
  keepCase: true,
  longs: String,
  enums: String,
  defaults: true,
  oneofs: true
});

const authProto = grpc.loadPackageDefinition(packageDefinition).auth;

// Implement gRPC service methods
const authService = {
  GetAllStudents: (call, callback) => {
    console.log('[gRPC] Get all students request');

    db.all('SELECT id, username, email FROM users WHERE role = "student" ORDER BY username', (err, students) => {
      if (err) {
        console.error('[gRPC] Error fetching students:', err);
        return callback(null, { users: [] });
      }

      const studentList = students.map(s => ({
        id: s.id,
        username: s.username,
        role: 'student',
        email: s.email || '',
        createdAt: ''
      }));

      callback(null, { users: studentList });
    });
  },
  
  Login: (call, callback) => {
    const { username, password } = call.request;
    
    console.log('[gRPC] Login attempt:', username);

    if (!username || !password) {
      return callback(null, {
        success: false,
        error: 'Username and password required'
      });
    }

    db.get('SELECT * FROM users WHERE username = ?', [username], (err, user) => {
      if (err || !user) {
        return callback(null, {
          success: false,
          error: 'Invalid credentials'
        });
      }

      if (!bcrypt.compareSync(password, user.password)) {
        return callback(null, {
          success: false,
          error: 'Invalid credentials'
        });
      }

      const token = jwt.sign(
        { userId: user.id, username: user.username, role: user.role },
        JWT_SECRET,
        { expiresIn: '24h' }
      );

      console.log('[gRPC] ✓ Login successful:', username);

      callback(null, {
        success: true,
        token: token,
        user: {
          userId: user.id,
          username: user.username,
          role: user.role,
          email: user.email || ''
        }
      });
    });
  },

  VerifyToken: (call, callback) => {
    const { token } = call.request;

    if (!token) {
      return callback(null, {
        valid: false,
        error: 'No token provided'
      });
    }

    try {
      const decoded = jwt.verify(token, JWT_SECRET);
      callback(null, {
        valid: true,
        user: {
          userId: decoded.userId,
          username: decoded.username,
          role: decoded.role,
          email: decoded.email || ''
        }
      });
    } catch (error) {
      callback(null, {
        valid: false,
        error: 'Invalid token'
      });
    }
  },

  Register: (call, callback) => {
    const { username, password, email, role } = call.request;
    const passwordRegex = /^(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*])(?=.{8,}).*$/;
    const emailRegex = /^[^\s@]+@[^\s@]+\.com$/;

    console.log('[gRPC] Registration attempt:', username);

    if (!username || !password || !role) {
      return callback(null, {
        success: false,
        error: 'Username, password, and role are required'
      });
    }

    if(!passwordRegex.test(password)){
      return callback(null, {
        success: false,
        error: 'Password has to contain an Uppercase, number, special character, and be 8 characters long'
      });      
    }

    if(!emailRegex.test(email)){
      return callback(null, {
        success: false,
        error: 'Invalid Email'
      });      
    }

    const hashedPassword = bcrypt.hashSync(password, 10);

    db.run(
      'INSERT INTO users (username, password, role, email) VALUES (?, ?, ?, ?)',
      [username, hashedPassword, role, email || ''],
      function(err) {
        if (err) {
          console.error('[gRPC] Registration error:', err);
          return callback(null, {
            success: false,
            error: 'Username already exists or database error'
          });
        }

        console.log('[gRPC] ✓ User registered:', username);

        callback(null, {
          success: true,
          userId: this.lastID,
          user: {
            userId: this.lastID,
            username: username,
            role: role,
            email: email || ''
          }
        });
      }
    );
  },

  GetAllUsers: (call, callback) => {
    console.log('[gRPC] Get all users request');

    db.all('SELECT id, username, role, email, createdAt FROM users ORDER BY id', (err, users) => {
      if (err) {
        console.error('[gRPC] Error fetching users:', err);
        return callback(null, { users: [] });
      }

      const userList = users.map(u => ({
        id: u.id,
        username: u.username,
        role: u.role,
        email: u.email || '',
        createdAt: u.createdAt || ''
      }));

      callback(null, { users: userList });
    });
  }
};

// Start gRPC server
function startGrpcServer() {
  const server = new grpc.Server();
  
  server.addService(authProto.AuthService.service, authService);
  
  const GRPC_PORT = '50051';
  server.bindAsync(
    `0.0.0.0:${GRPC_PORT}`,
    grpc.ServerCredentials.createInsecure(),
    (err, port) => {
      if (err) {
        console.error('[gRPC] Failed to start server:', err);
        return;
      }
      console.log('========================================');
      console.log(`[gRPC] Auth service running on port ${GRPC_PORT}`);
      console.log('========================================');
    }
  );
}

module.exports = { startGrpcServer };