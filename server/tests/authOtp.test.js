const request = require('supertest');

// Catch the codes instead of sending real email
jest.mock('../services/email.service', () => ({
  ...jest.requireActual('../services/email.service'),
  sendOtpEmail: jest.fn().mockResolvedValue({}),
}));

const app = require('../app');
const emailService = require('../services/email.service');
const OtpCode = require('../models/OtpCode');
const User = require('../models/User');

const lastCode = () => emailService.sendOtpEmail.mock.calls.at(-1)[0].code;
const wrongCode = (real) => (real === '000000' ? '111111' : '000000');
const sendCode = (email) => request(app).post('/api/auth/otp/send').send({ email });
const register = (details) => request(app).post('/api/auth/register').send(details);

const broker = { name: 'New Broker', email: 'new.broker@test.com', password: 'password123', role: 'owner' };

describe('Email code at sign-up', () => {
  it('emails a code to the address given and creates the account only with it', async () => {
    const sent = await sendCode('New.Broker@Test.com');
    expect(sent.statusCode).toBe(200);
    expect(sent.body.devCode).toBeUndefined(); // never shown on screen unless explicitly enabled
    expect(emailService.sendOtpEmail.mock.calls.at(-1)[0].to).toBe('new.broker@test.com');
    const code = lastCode();
    expect(code).toMatch(/^\d{6}$/);

    const res = await register({ ...broker, email: 'New.Broker@Test.com', code });
    expect(res.statusCode).toBe(201);
    expect(res.body.data.user).toMatchObject({
      name: 'New Broker',
      email: 'new.broker@test.com',
      role: 'owner',
      emailVerified: true,
    });
    expect(res.body.data.accessToken).toBeDefined();
    expect(res.headers['set-cookie'].join(';')).toContain('refreshToken=');
    expect(await OtpCode.countDocuments({ email: 'new.broker@test.com' })).toBe(0); // used up

    // From now on the password is enough; no code when signing in
    const login = await request(app).post('/api/auth/login').send({ email: broker.email, password: broker.password });
    expect(login.statusCode).toBe(200);
  });

  it('won’t create an account without the right code', async () => {
    const details = { ...broker, email: 'nocode@test.com' };
    expect((await register(details)).statusCode).toBe(400); // never asked for one

    await sendCode(details.email).expect(200);
    expect((await register(details)).statusCode).toBe(400); // asked, but didn't send it along
    expect((await register({ ...details, code: wrongCode(lastCode()) })).statusCode).toBe(400);
    expect(await User.findOne({ email: details.email })).toBeNull();
  });

  it('refuses a code for an email that already has an account, or isn’t an email', async () => {
    const taken = await sendCode('new.broker@test.com');
    expect(taken.statusCode).toBe(409);
    expect(taken.body.message).toMatch(/Sign in instead/);

    expect((await sendCode('not-an-email')).statusCode).toBe(400);
  });

  it('allows asking for a new code once every 30 seconds', async () => {
    await sendCode('resend@test.com').expect(200);
    expect((await sendCode('resend@test.com')).statusCode).toBe(429);
  });

  it('ends the code after 5 wrong tries', async () => {
    const details = { ...broker, email: 'guess@test.com' };
    await sendCode(details.email).expect(200);
    const real = lastCode();

    for (let i = 0; i < 5; i++) {
      expect((await register({ ...details, code: wrongCode(real) })).statusCode).toBe(400);
    }
    // Even the right code no longer works
    expect((await register({ ...details, code: real })).statusCode).toBe(429);
    expect(await User.findOne({ email: details.email })).toBeNull();
  });

  it('counts tries sent at the same moment too', async () => {
    const details = { ...broker, email: 'burst@test.com' };
    await sendCode(details.email).expect(200);
    const real = lastCode();

    const results = await Promise.all(Array.from({ length: 8 }, () => register({ ...details, code: wrongCode(real) })));
    const compared = results.filter((r) => /code isn.t right/.test(r.body.message));
    expect(compared).toHaveLength(5);
    expect((await register({ ...details, code: real })).statusCode).not.toBe(201);
  });

  it('rejects expired codes', async () => {
    const details = { ...broker, email: 'late@test.com' };
    await sendCode(details.email).expect(200);
    await OtpCode.updateOne({ email: details.email }, { expiresAt: new Date(Date.now() - 1000) });

    const res = await register({ ...details, code: lastCode() });
    expect(res.statusCode).toBe(400);
    expect(res.body.message).toMatch(/expired/i);
  });

  it('checks the other details before using up the code', async () => {
    const details = { ...broker, email: 'details@test.com' };
    await sendCode(details.email).expect(200);
    const code = lastCode();

    expect((await register({ ...details, code, password: 'short' })).statusCode).toBe(400);
    expect((await register({ ...details, code, name: '  ' })).statusCode).toBe(400);
    expect((await register({ ...details, code, role: 'admin' })).statusCode).toBe(400);
    // Those mistakes didn't cost the code
    expect((await register({ ...details, code })).statusCode).toBe(201);
  });

  it('shows the code on screen only when OTP_DEV_ECHO is on outside production', async () => {
    process.env.OTP_DEV_ECHO = 'true';
    const res = await sendCode('echo@test.com');
    expect(res.body.devCode).toBe(lastCode());

    process.env.NODE_ENV = 'production';
    await OtpCode.deleteMany({ email: 'echo@test.com' });
    const prod = await sendCode('echo@test.com');
    expect(prod.body.devCode).toBeUndefined();

    process.env.NODE_ENV = 'test';
    delete process.env.OTP_DEV_ECHO;
  });

  it('points Google accounts to Google instead of failing on the missing password', async () => {
    await User.create({ name: 'G User', email: 'g.user@gmail.com', role: 'student', emailVerified: true });
    const res = await request(app).post('/api/auth/login').send({ email: 'g.user@gmail.com', password: 'whatever123' });
    expect(res.statusCode).toBe(401);
    expect(res.body.message).toMatch(/Continue with Google/);
  });

  it('no longer signs anyone in with only an email code', async () => {
    const res = await request(app).post('/api/auth/otp/verify').send({ email: broker.email, code: '123456', purpose: 'login' });
    expect(res.statusCode).toBe(404);
  });
});
