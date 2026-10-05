process.env.JWT_ACCESS_SECRET = 'test_access_secret_32chars_minimum';
process.env.JWT_REFRESH_SECRET = 'test_refresh_secret_32chars_minimum';
process.env.JWT_ACCESS_EXPIRE = '15m';
process.env.JWT_REFRESH_EXPIRE = '7d';
process.env.NODE_ENV = 'test';
process.env.CLIENT_URL = 'http://localhost:5173';

const request = require('supertest');
const app = require('../../app');
const db = require('../db.helper');
const { registerUser } = require('../auth.helper');

beforeAll(async () => await db.connect());
afterEach(async () => await db.clearDatabase());
afterAll(async () => await db.closeDatabase());

describe('Auth API', () => {
  const baseUser = {
    name: 'Test Student',
    email: 'student@test.com',
    password: 'Password123!',
    role: 'student',
  };

  describe('POST /api/auth/register', () => {
    it('should register a new user and return tokens', async () => {
      const res = await registerUser(app, baseUser);
      expect(res.status).toBe(201);
      expect(res.body.status).toBe('success');
      expect(res.body.data.user.email).toBe(baseUser.email);
      expect(res.body.data.accessToken).toBeDefined();
    });

    it('should reject duplicate email registration', async () => {
      await registerUser(app, baseUser);
      const res = await registerUser(app, baseUser);
      expect(res.status).toBe(409);
    });

    it('should reject short password', async () => {
      const res = await registerUser(app, { ...baseUser, password: '123' });
      expect(res.status).toBe(400);
    });

    it('should reject invalid email', async () => {
      const res = await registerUser(app, { ...baseUser, email: 'not-an-email' });
      expect(res.status).toBe(400);
    });
  });

  describe('POST /api/auth/login', () => {
    beforeEach(async () => {
      await registerUser(app, baseUser);
    });

    it('should login with correct credentials', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({ email: baseUser.email, password: baseUser.password });
      expect(res.status).toBe(200);
      expect(res.body.data.accessToken).toBeDefined();
    });

    it('should reject wrong password', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({ email: baseUser.email, password: 'WrongPass!' });
      expect(res.status).toBe(401);
    });

    it('should reject non-existent email', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({ email: 'no@one.com', password: 'AnyPass123!' });
      expect(res.status).toBe(401);
    });
  });

  describe('GET /api/auth/me', () => {
    it('should return current user when authenticated', async () => {
      const regRes = await registerUser(app, baseUser);
      const token = regRes.body.data.accessToken;

      const res = await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(200);
      expect(res.body.data.user.email).toBe(baseUser.email);
    });

    it('should reject unauthenticated request', async () => {
      const res = await request(app).get('/api/auth/me');
      expect(res.status).toBe(401);
    });
  });

  describe('POST /api/auth/logout', () => {
    it('should logout successfully', async () => {
      const regRes = await registerUser(app, baseUser);
      const token = regRes.body.data.accessToken;

      const res = await request(app)
        .post('/api/auth/logout')
        .set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(200);
    });
  });
});
