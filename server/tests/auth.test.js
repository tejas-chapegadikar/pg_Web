const request = require('supertest');
const app = require('../app');
const User = require('../models/User');
const { registerUser } = require('./auth.helper');

describe('Auth Routes', () => {
  const testUser = {
    name: 'Test Student',
    email: 'test@student.com',
    password: 'password123',
    role: 'student'
  };

  beforeEach(async () => {
    await User.deleteMany({});
  });

  it('should register a new user successfully', async () => {
    const res = await registerUser(app, testUser);

    expect(res.statusCode).toBe(201);
    expect(res.body.status).toBe('success');
    expect(res.body.data.user.email).toBe(testUser.email);
    expect(res.body.data.accessToken).toBeDefined();
    
    // Check if user was actually created
    const userInDb = await User.findOne({ email: testUser.email });
    expect(userInDb).toBeTruthy();
  });

  it('should login an existing user', async () => {
    await User.create(testUser);

    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: testUser.email, password: testUser.password });
    
    expect(res.statusCode).toBe(200);
    expect(res.body.status).toBe('success');
    expect(res.body.data.accessToken).toBeDefined();
  });
});
