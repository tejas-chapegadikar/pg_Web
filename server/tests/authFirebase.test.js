const request = require('supertest');

// Firebase verifies the real Google / SMS sign-in on the client; here we fake its decoded tokens
jest.mock('../services/firebaseAdmin', () => ({ verifyFirebaseIdToken: jest.fn() }));

const app = require('../app');
const User = require('../models/User');
const { verifyFirebaseIdToken } = require('../services/firebaseAdmin');
const { registerUser } = require('./auth.helper');

const googleToken = (overrides = {}) => ({
  uid: 'google-uid-1',
  email: 'Ananya@Gmail.com',
  email_verified: true,
  name: 'Ananya Sharma',
  picture: 'https://example.com/a.png',
  firebase: { sign_in_provider: 'google.com' },
  ...overrides,
});

const phoneToken = (overrides = {}) => ({
  uid: 'phone-uid-1',
  phone_number: '+919876543210',
  firebase: { sign_in_provider: 'phone' },
  ...overrides,
});

describe('Google sign-in', () => {
  it('creates an account with the chosen role, then signs the same person in', async () => {
    verifyFirebaseIdToken.mockResolvedValue(googleToken());

    const first = await request(app).post('/api/auth/google').send({ idToken: 'token', role: 'owner' });
    expect(first.statusCode).toBe(201);
    expect(first.body.data.user).toMatchObject({
      email: 'ananya@gmail.com',
      name: 'Ananya Sharma',
      role: 'owner',
      avatar: 'https://example.com/a.png',
      isOnboarded: false,
    });

    // Signing in later (even with a different role picked) returns the same account
    const second = await request(app).post('/api/auth/google').send({ idToken: 'token', role: 'student' });
    expect(second.statusCode).toBe(200);
    expect(second.body.data.user._id).toBe(first.body.data.user._id);
    expect(second.body.data.user.role).toBe('owner');
  });

  it('links to an existing email/password account', async () => {
    const reg = await registerUser(app, { name: 'Rohan', email: 'rohan@gmail.com', password: 'password123', role: 'student' });
    verifyFirebaseIdToken.mockResolvedValue(googleToken({ email: 'rohan@gmail.com', name: 'Rohan D' }));

    const res = await request(app).post('/api/auth/google').send({ idToken: 'token', role: 'student' });
    expect(res.statusCode).toBe(200);
    expect(res.body.data.user._id).toBe(reg.body.data.user._id);
    expect(res.body.data.user.emailVerified).toBe(true);
  });

  it('rejects unverified emails and non-Google tokens', async () => {
    verifyFirebaseIdToken.mockResolvedValue(googleToken({ email: 'x@test.com', email_verified: false }));
    expect((await request(app).post('/api/auth/google').send({ idToken: 't', role: 'student' })).statusCode).toBe(400);

    verifyFirebaseIdToken.mockResolvedValue(phoneToken());
    expect((await request(app).post('/api/auth/google').send({ idToken: 't', role: 'student' })).statusCode).toBe(400);
  });

  it('needs a valid role for a new account', async () => {
    verifyFirebaseIdToken.mockResolvedValue(googleToken({ email: 'norole@gmail.com' }));
    const res = await request(app).post('/api/auth/google').send({ idToken: 't' });
    expect(res.statusCode).toBe(400);
    expect(await User.findOne({ email: 'norole@gmail.com' })).toBeNull();
  });
});

describe('Phone OTP (Firebase)', () => {
  it('signs up with name and role, already onboarded', async () => {
    verifyFirebaseIdToken.mockResolvedValue(phoneToken());
    const res = await request(app)
      .post('/api/auth/phone')
      .send({ idToken: 't', purpose: 'signup', name: 'Priya Gogoi', role: 'student' });
    expect(res.statusCode).toBe(201);
    expect(res.body.data.user).toMatchObject({
      phone: '+919876543210',
      name: 'Priya Gogoi',
      role: 'student',
      phoneVerified: true,
      isOnboarded: true,
    });
  });

  it('signs in an existing number and refuses a second sign-up', async () => {
    verifyFirebaseIdToken.mockResolvedValue(phoneToken());
    const login = await request(app).post('/api/auth/phone').send({ idToken: 't', purpose: 'login' });
    expect(login.statusCode).toBe(200);
    expect(login.body.data.user.name).toBe('Priya Gogoi');

    const dup = await request(app)
      .post('/api/auth/phone')
      .send({ idToken: 't', purpose: 'signup', name: 'Someone', role: 'owner' });
    expect(dup.statusCode).toBe(409);
  });

  it('refuses to sign in a number with no account', async () => {
    verifyFirebaseIdToken.mockResolvedValue(phoneToken({ uid: 'phone-uid-2', phone_number: '+919000000000' }));
    const res = await request(app).post('/api/auth/phone').send({ idToken: 't', purpose: 'login' });
    expect(res.statusCode).toBe(404);
  });

  it('matches accounts that saved the number without +91', async () => {
    const reg = await registerUser(app, { name: 'Kabir', email: 'kabir@test.com', password: 'password123', role: 'owner', phone: '9111111111' });
    verifyFirebaseIdToken.mockResolvedValue(phoneToken({ uid: 'phone-uid-3', phone_number: '+919111111111' }));

    const res = await request(app).post('/api/auth/phone').send({ idToken: 't', purpose: 'login' });
    expect(res.statusCode).toBe(200);
    expect(res.body.data.user._id).toBe(reg.body.data.user._id);
  });
});
