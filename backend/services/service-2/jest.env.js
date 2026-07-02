process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-jwt-secret';
process.env.JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || 'test-jwt-refresh-secret';
// Clear MONGODB_URI so tests use the test database (Node 21+ auto-loads .env)
delete process.env.MONGODB_URI;
