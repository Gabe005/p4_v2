module.exports = {
  AUTH_SERVICE: process.env.AUTH_SERVICE || 'http://localhost:3001',
  COURSE_SERVICE: process.env.COURSE_SERVICE || 'http://localhost:3002',
  GRADE_SERVICE: process.env.GRADE_SERVICE || 'http://localhost:3003',
  JWT_SECRET: process.env.JWT_SECRET || 'your-super-secret-jwt-key-change-in-production-2024',
  JWT_EXPIRES_IN: '24h'
};