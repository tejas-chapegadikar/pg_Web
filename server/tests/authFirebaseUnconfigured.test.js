const request = require('supertest');

describe('Google / phone sign-in without Firebase configured', () => {
  let app;

  beforeAll(() => {
    delete process.env.FIREBASE_PROJECT_ID;
    app = require('../app');
  });

  it('answers 503 with a clear message instead of crashing', async () => {
    const google = await request(app).post('/api/auth/google').send({ idToken: 'anything', role: 'student' });
    expect(google.statusCode).toBe(503);
    expect(google.body.message).toMatch(/aren’t set up/);

    const phone = await request(app).post('/api/auth/phone').send({ idToken: 'anything', purpose: 'login' });
    expect(phone.statusCode).toBe(503);
  });
});
