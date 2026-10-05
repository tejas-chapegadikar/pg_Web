process.env.JWT_ACCESS_SECRET = 'test_access_secret_32chars_minimum';
process.env.JWT_REFRESH_SECRET = 'test_refresh_secret_32chars_minimum';
process.env.JWT_ACCESS_EXPIRE = '15m';
process.env.JWT_REFRESH_EXPIRE = '7d';
process.env.NODE_ENV = 'test';
process.env.CLIENT_URL = 'http://localhost:5173';

// Mock cloudinary to avoid real API calls
jest.mock('../../middleware/upload', () => ({
  cloudinary: { uploader: { destroy: jest.fn() } },
  upload: {
    array: () => (req, res, next) => {
      req.files = [];
      next();
    },
  },
  handleUploadErrors: (middleware) => middleware,
}));

const request = require('supertest');
const app = require('../../app');
const db = require('../db.helper');
const { registerUser } = require('../auth.helper');

beforeAll(async () => await db.connect());
afterEach(async () => await db.clearDatabase());
afterAll(async () => await db.closeDatabase());

const ownerData = {
  name: 'Test Owner',
  email: 'owner@test.com',
  password: 'Password123!',
  role: 'owner',
};

const studentData = {
  name: 'Test Student',
  email: 'student@test.com',
  password: 'Password123!',
  role: 'student',
};

const pgData = {
  title: 'Test PG Mumbai',
  description: 'A comfortable PG near the metro station with all amenities.',
  location: {
    address: '123 Main Street',
    city: 'mumbai',
    state: 'Maharashtra',
    pincode: '400001',
  },
  rent: 8000,
  deposit: 16000,
  genderPreference: 'any',
  roomType: 'single',
  amenities: ['wifi', 'ac'],
  totalRooms: 10,
  availableRooms: 5,
};

let ownerToken;
let studentToken;

const registerAndLogin = async (userData) => {
  const res = await registerUser(app, userData);
  return res.body.data.accessToken;
};

describe('PG Listing API', () => {
  beforeEach(async () => {
    ownerToken = await registerAndLogin(ownerData);
    studentToken = await registerAndLogin(studentData);
  });

  describe('POST /api/pg', () => {
    it('should create a PG listing as owner', async () => {
      const res = await request(app)
        .post('/api/pg')
        .set('Authorization', `Bearer ${ownerToken}`)
        .send(pgData);
      expect(res.status).toBe(201);
      expect(res.body.data.pg.title).toBe(pgData.title);
    });

    it('should reject creation by student', async () => {
      const res = await request(app)
        .post('/api/pg')
        .set('Authorization', `Bearer ${studentToken}`)
        .send(pgData);
      expect(res.status).toBe(403);
    });

    it('should reject unauthenticated request', async () => {
      const res = await request(app).post('/api/pg').send(pgData);
      expect(res.status).toBe(401);
    });
  });

  describe('GET /api/pg', () => {
    it('should return listings publicly', async () => {
      await request(app)
        .post('/api/pg')
        .set('Authorization', `Bearer ${ownerToken}`)
        .send(pgData);

      const res = await request(app).get('/api/pg');
      expect(res.status).toBe(200);
      expect(res.body.listings).toBeInstanceOf(Array);
      expect(res.body.pagination).toBeDefined();
    });

    it('should filter by city', async () => {
      await request(app)
        .post('/api/pg')
        .set('Authorization', `Bearer ${ownerToken}`)
        .send(pgData);

      const res = await request(app).get('/api/pg?city=mumbai');
      expect(res.status).toBe(200);
      expect(res.body.listings.length).toBeGreaterThan(0);
    });

    it('should return empty for non-matching city', async () => {
      const res = await request(app).get('/api/pg?city=nonexistentcity');
      expect(res.status).toBe(200);
      expect(res.body.listings.length).toBe(0);
    });
  });

  describe('GET /api/pg/:id', () => {
    it('should return a single PG and increment view count', async () => {
      const createRes = await request(app)
        .post('/api/pg')
        .set('Authorization', `Bearer ${ownerToken}`)
        .send(pgData);
      const pgId = createRes.body.data.pg._id;

      const res = await request(app).get(`/api/pg/${pgId}`);
      expect(res.status).toBe(200);
      expect(res.body.data.pg._id).toBe(pgId);
    });

    it('should return 404 for invalid id', async () => {
      const res = await request(app).get('/api/pg/000000000000000000000000');
      expect(res.status).toBe(404);
    });
  });

  describe('PUT /api/pg/:id', () => {
    it('should update PG as owner', async () => {
      const createRes = await request(app)
        .post('/api/pg')
        .set('Authorization', `Bearer ${ownerToken}`)
        .send(pgData);
      const pgId = createRes.body.data.pg._id;

      const res = await request(app)
        .put(`/api/pg/${pgId}`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({ rent: 9000 });
      expect(res.status).toBe(200);
      expect(res.body.data.pg.rent).toBe(9000);
    });
  });

  describe('DELETE /api/pg/:id', () => {
    it('should soft delete a PG as owner', async () => {
      const createRes = await request(app)
        .post('/api/pg')
        .set('Authorization', `Bearer ${ownerToken}`)
        .send(pgData);
      const pgId = createRes.body.data.pg._id;

      const res = await request(app)
        .delete(`/api/pg/${pgId}`)
        .set('Authorization', `Bearer ${ownerToken}`);
      expect(res.status).toBe(204);
    });
  });
});
