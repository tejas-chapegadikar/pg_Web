const request = require('supertest');
const app = require('../app');
const WaitlistEntry = require('../models/WaitlistEntry');

describe('Waitlist', () => {
  beforeAll(() => WaitlistEntry.init()); // build the unique index before parallel joins

  it('adds an email and returns the new count', async () => {
    const res = await request(app).post('/api/waitlist').send({ email: '  First@Test.com ' });
    expect(res.statusCode).toBe(201);
    expect(res.body.data).toEqual({ alreadyJoined: false, count: 1, students: 1, owners: 0 });
    expect(await WaitlistEntry.findOne({ email: 'first@test.com' })).not.toBeNull();
  });

  it('treats joining again as success without a second row', async () => {
    const res = await request(app).post('/api/waitlist').send({ email: 'first@test.com' });
    expect(res.statusCode).toBe(200);
    expect(res.body.data.alreadyJoined).toBe(true);
    expect(await WaitlistEntry.countDocuments({ email: 'first@test.com' })).toBe(1);
  });

  it('saves whether they are a student or a broker', async () => {
    await request(app).post('/api/waitlist').send({ email: 'broker@test.com', role: 'owner' });
    expect((await WaitlistEntry.findOne({ email: 'broker@test.com' })).role).toBe('owner');
    await request(app).post('/api/waitlist').send({ email: 'odd@test.com', role: 'admin' });
    expect((await WaitlistEntry.findOne({ email: 'odd@test.com' })).role).toBe('student');
  });

  it('keeps one row when the same email is sent twice at once', async () => {
    await Promise.all([1, 2].map(() => request(app).post('/api/waitlist').send({ email: 'twice@test.com' })));
    expect(await WaitlistEntry.countDocuments({ email: 'twice@test.com' })).toBe(1);
  });

  it.each([[{}], [{ email: 'not-an-email' }], [{ email: { $gt: '' } }]])('refuses %j', async (body) => {
    const res = await request(app).post('/api/waitlist').send(body);
    expect(res.statusCode).toBe(400);
  });

  it('reports the count, with students and owners apart', async () => {
    const res = await request(app).get('/api/waitlist/count');
    expect(res.statusCode).toBe(200);
    expect(res.body.data).toEqual({
      count: await WaitlistEntry.countDocuments(),
      students: await WaitlistEntry.countDocuments({ role: 'student' }),
      owners: 1,
    });
  });
});
