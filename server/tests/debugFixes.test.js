const request = require('supertest');
const app = require('../app');
const User = require('../models/User');
const PGListing = require('../models/PGListing');
const ImageFile = require('../models/ImageFile');
const { registerUser } = require('./auth.helper');

const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=',
  'base64'
);

const LISTING = {
  title: 'Fixes PG', description: 'A description that is long enough to pass',
  location: { address: '1 Road', city: 'jorhat', state: 'Assam', pincode: '785001' },
  rent: 5000, deposit: 0, genderPreference: 'any', roomType: 'single', totalRooms: 2, availableRooms: 1,
};

const bearer = (token) => ['Authorization', `Bearer ${token}`];
const cookieFrom = (res) => res.headers['set-cookie'].find((c) => c.startsWith('refreshToken=')).split(';')[0];

describe('sessions', () => {
  const account = { email: 'devices@test.com', password: 'password123' };
  const login = () => request(app).post('/api/auth/login').send(account);

  beforeAll(async () => {
    await registerUser(app, { ...account, name: 'Devices', role: 'student' });
  });

  it('keeps a first device signed in after a second one logs in', async () => {
    const phone = cookieFrom(await login());
    await login();
    const res = await request(app).post('/api/auth/refresh').set('Cookie', phone);
    expect(res.statusCode).toBe(200);
  });

  it('spends a refresh token only once', async () => {
    const cookie = cookieFrom(await login());
    const results = await Promise.all([
      request(app).post('/api/auth/refresh').set('Cookie', cookie),
      request(app).post('/api/auth/refresh').set('Cookie', cookie),
    ]);
    expect(results.map((r) => r.statusCode).sort()).toEqual([200, 401]);
  });

  it('still accepts a token saved before multi-device sessions, then moves it', async () => {
    const cookie = cookieFrom(await login());
    const token = cookie.replace('refreshToken=', '');
    await User.updateOne({ email: account.email }, { $pull: { refreshTokens: token }, $set: { refreshToken: token } });

    expect((await request(app).post('/api/auth/refresh').set('Cookie', cookie)).statusCode).toBe(200);
    const user = await User.findOne({ email: account.email }).select('+refreshToken');
    expect(user.refreshToken).toBeUndefined();
  });

  it('ends only this device on logout, without needing an access token', async () => {
    const laptop = cookieFrom(await login());
    const phone = cookieFrom(await login());

    expect((await request(app).post('/api/auth/logout').set('Cookie', laptop)).statusCode).toBe(200);
    expect((await request(app).post('/api/auth/refresh').set('Cookie', laptop)).statusCode).toBe(401);
    expect((await request(app).post('/api/auth/refresh').set('Cookie', phone)).statusCode).toBe(200);
  });

  it('never returns session tokens to the browser', async () => {
    const res = await login();
    expect(res.body.data.user.refreshTokens).toBeUndefined();
  });

  it('answers a login with no password with a 400, not a crash', async () => {
    const res = await request(app).post('/api/auth/login').send({ email: account.email });
    expect(res.statusCode).toBe(400);
  });
});

describe('listings', () => {
  let brokerToken;
  let otherBrokerToken;
  let studentToken;
  let pgId;

  beforeAll(async () => {
    brokerToken = (await registerUser(app, {
      name: 'Broker', email: 'broker-fix@test.com', password: 'password123', role: 'owner', phone: '9876543210',
    })).body.data.accessToken;
    otherBrokerToken = (await registerUser(app, {
      name: 'Other', email: 'other-fix@test.com', password: 'password123', role: 'owner',
    })).body.data.accessToken;
    studentToken = (await registerUser(app, {
      name: 'Student', email: 'student-fix@test.com', password: 'password123', role: 'student',
    })).body.data.accessToken;

    pgId = (await request(app).post('/api/pg').set(...bearer(brokerToken)).send(LISTING)).body.data.pg._id;
  });

  it('keeps broker contact details out of the public list and page', async () => {
    const list = await request(app).get('/api/pg');
    expect(list.body.listings[0].owner.name).toBe('Broker');
    expect(list.body.listings[0].owner.email).toBeUndefined();
    expect(list.body.listings[0].owner.phone).toBeUndefined();

    const page = await request(app).get(`/api/pg/${pgId}`);
    expect(page.statusCode).toBe(200);
    expect(page.body.data.pg.owner.email).toBeUndefined();
    expect(page.body.data.pg.owner.phone).toBeUndefined();
  });

  it('gives signed-in students the phone number for WhatsApp', async () => {
    const res = await request(app).get(`/api/pg/${pgId}`).set(...bearer(studentToken));
    expect(res.body.data.pg.owner.phone).toBe('9876543210');
  });

  it('answers an expired or bad token with a 401 so the client refreshes it', async () => {
    const res = await request(app).get(`/api/pg/${pgId}`).set(...bearer('not-a-token'));
    expect(res.statusCode).toBe(401);
  });

  it('does not count a broker viewing their own listing', async () => {
    const before = (await PGListing.findById(pgId)).analytics.views;
    await request(app).get(`/api/pg/${pgId}`).set(...bearer(brokerToken));
    expect((await PGListing.findById(pgId)).analytics.views).toBe(before);

    await request(app).get(`/api/pg/${pgId}`).set(...bearer(studentToken));
    expect((await PGListing.findById(pgId)).analytics.views).toBe(before + 1);
  });

  it('ignores faked ratings and view counts from brokers', async () => {
    const created = await request(app).post('/api/pg').set(...bearer(brokerToken))
      .send({ ...LISTING, ratingAverage: 5, numReviews: 999 });
    expect(created.body.data.pg.ratingAverage).toBe(0);
    expect(created.body.data.pg.numReviews).toBe(0);

    const updated = await request(app).patch(`/api/pg/${pgId}`).set(...bearer(brokerToken))
      .send({ rent: 6000, ratingAverage: 5, analytics: { views: 99999 } });
    expect(updated.body.data.pg.rent).toBe(6000);
    expect(updated.body.data.pg.ratingAverage).toBe(0);
    expect(updated.body.data.pg.analytics.views).toBeLessThan(99999);
  });

  it('stores nothing when photos are sent to someone else\'s listing', async () => {
    const before = await ImageFile.countDocuments();
    const res = await request(app).post(`/api/pg/${pgId}/images`).set(...bearer(otherBrokerToken))
      .attach('images', PNG, { filename: 'room.png', contentType: 'image/png' });
    expect(res.statusCode).toBe(404);
    expect(await ImageFile.countDocuments()).toBe(before);
  });

  it('leaves deleted listings out of the page count', async () => {
    const extra = (await request(app).post('/api/pg').set(...bearer(brokerToken))
      .send({ ...LISTING, title: 'Soon deleted' })).body.data.pg._id;
    const before = (await request(app).get('/api/pg')).body.pagination.total;
    await request(app).delete(`/api/pg/${extra}`).set(...bearer(brokerToken));
    expect((await request(app).get('/api/pg')).body.pagination.total).toBe(before - 1);
  });

  it('treats symbols in a city search as plain text', async () => {
    const res = await request(app).get('/api/pg?city=' + encodeURIComponent('('));
    expect(res.statusCode).toBe(200);
    expect(res.body.listings).toEqual([]);
  });
});

describe('reviews in production', () => {
  beforeEach(() => { process.env.NODE_ENV = 'production'; });
  afterEach(() => { process.env.NODE_ENV = 'test'; });

  it('answers a bad page number normally', async () => {
    const res = await request(app).get('/api/pg/000000000000000000000000/reviews?page=-1');
    expect(res.statusCode).toBe(200);
  });

  it('says a missing review is missing rather than a server error', async () => {
    const student = (await registerUser(app, {
      name: 'Reviewer', email: 'reviewer-fix@test.com', password: 'password123', role: 'student',
    })).body.data.accessToken;
    const res = await request(app).delete('/api/reviews/000000000000000000000000').set(...bearer(student));
    expect(res.statusCode).toBe(404);
  });
});
