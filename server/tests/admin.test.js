const request = require('supertest');
const app = require('../app');
const User = require('../models/User');
const PGListing = require('../models/PGListing');
const WaitlistEntry = require('../models/WaitlistEntry');
const ActivityLog = require('../models/ActivityLog');
const PlatformSetting = require('../models/PlatformSetting');
const { registerUser } = require('./auth.helper');

const signUp = async (email, role = 'student') => {
  const res = await registerUser(app, { name: email.split('@')[0], email, password: 'Password123!', role });
  expect(res.statusCode).toBe(201);
  return { token: res.body.data.accessToken, id: res.body.data.user._id };
};
const auth = (token) => ({ Authorization: `Bearer ${token}` });

const listing = (extra = {}) => ({
  propertyType: 'pg',
  title: 'Admin Test PG',
  description: 'A clean PG close to college.',
  location: { address: 'Near gate', city: 'jorhat', state: 'Assam', pincode: '785001', locality: 'Garali' },
  rent: 5000,
  genderPreference: 'any',
  roomType: 'double',
  totalRooms: 4,
  availableRooms: 2,
  amenities: ['wifi'],
  contact: { name: 'Mr Das', phone: '9876543210' },
  ...extra,
});

describe('Admin panel', () => {
  let founder, cofounder, student, broker;

  beforeAll(async () => {
    process.env.FOUNDER_EMAILS = 'founder@admin.test';
    process.env.COFOUNDER_EMAILS = 'cofounder@admin.test';
    founder = await signUp('founder@admin.test');
    cofounder = await signUp('cofounder@admin.test');
    student = await signUp('student@admin.test');
    broker = await signUp('broker@admin.test', 'owner');
  });

  afterAll(async () => {
    delete process.env.FOUNDER_EMAILS;
    delete process.env.COFOUNDER_EMAILS;
    await Promise.all([User.deleteMany({}), PGListing.deleteMany({}), WaitlistEntry.deleteMany({}), ActivityLog.collection.deleteMany({}), PlatformSetting.deleteMany({})]);
  });

  it('lets the founder and co-founder in, with the right role', async () => {
    const f = await request(app).get('/api/admin/me').set(auth(founder.token));
    expect(f.statusCode).toBe(200);
    expect(f.body.data.adminRole).toBe('founder');
    const c = await request(app).get('/api/admin/me').set(auth(cofounder.token));
    expect(c.body.data.adminRole).toBe('cofounder');
  });

  it('keeps students, brokers and visitors out of every admin API', async () => {
    for (const path of ['/api/admin/me', '/api/admin/overview', '/api/admin/waitlist', '/api/admin/users', '/api/admin/logs']) {
      expect((await request(app).get(path)).statusCode).toBe(401);
      expect((await request(app).get(path).set(auth(student.token))).statusCode).toBe(403);
      expect((await request(app).get(path).set(auth(broker.token))).statusCode).toBe(403);
    }
    expect((await request(app).patch('/api/admin/settings').set(auth(student.token)).send({ mode: 'public' })).statusCode).toBe(403);
  });

  it('ignores an admin role sent by the browser', async () => {
    await request(app).patch('/api/auth/me').set(auth(student.token)).send({ adminRole: 'founder', role: 'owner' });
    const me = await User.findById(student.id);
    expect(me.adminRole).toBeUndefined();
    expect(me.role).toBe('student'); // role is fixed after onboarding
    expect((await request(app).get('/api/admin/me').set(auth(student.token))).statusCode).toBe(403);
  });

  it('adds a listing that shows up in the main app, and logs it', async () => {
    const res = await request(app).post('/api/admin/properties').set(auth(cofounder.token)).send(listing());
    expect(res.statusCode).toBe(201);
    const id = res.body.data.pg._id;

    const pub = await request(app).get('/api/pg');
    expect(pub.body.listings.map((l) => l._id)).toContain(id);
    // The contact person is shown instead of the admin's own name
    expect(pub.body.listings.find((l) => l._id === id).owner.name).toBe('Mr Das');

    const log = await ActivityLog.findOne({ action: 'property.create', targetId: id });
    expect(log.adminEmail).toBe('cofounder@admin.test');
  });

  it('hides deactivated, pending and rejected listings from students', async () => {
    const { body } = await request(app).post('/api/admin/properties').set(auth(founder.token)).send(listing({ title: 'Hide me' }));
    const id = body.data.pg._id;
    const visible = async () => (await request(app).get('/api/pg')).body.listings.some((l) => l._id === id);

    await request(app).post(`/api/admin/properties/${id}/status`).set(auth(founder.token)).send({ action: 'deactivate' });
    expect(await visible()).toBe(false);
    expect((await request(app).get(`/api/pg/${id}`).set(auth(student.token))).statusCode).toBe(404);

    await request(app).post(`/api/admin/properties/${id}/status`).set(auth(founder.token)).send({ action: 'activate' });
    expect(await visible()).toBe(true);

    await request(app).post(`/api/admin/properties/${id}/status`).set(auth(founder.token)).send({ action: 'reject', reason: 'Blurry photos' });
    expect(await visible()).toBe(false);
    const logs = await ActivityLog.find({ targetId: id }).sort({ createdAt: 1 });
    expect(logs.map((l) => l.action)).toEqual(['property.create', 'property.deactivate', 'property.activate', 'property.reject']);
  });

  it('holds broker listings for approval when that setting is on', async () => {
    await request(app).patch('/api/admin/settings').set(auth(founder.token)).send({ requireApproval: true });
    const res = await request(app).post('/api/pg').set(auth(broker.token)).send(listing({ title: 'Broker PG', contact: undefined }));
    expect(res.body.data.pg.status).toBe('pending');
    const id = res.body.data.pg._id;
    expect((await request(app).get('/api/pg')).body.listings.some((l) => l._id === id)).toBe(false);

    await request(app).post(`/api/admin/properties/${id}/status`).set(auth(cofounder.token)).send({ action: 'approve' });
    expect((await request(app).get('/api/pg')).body.listings.some((l) => l._id === id)).toBe(true);
    await request(app).patch('/api/admin/settings').set(auth(founder.token)).send({ requireApproval: false });
  });

  it('lets only the founder change the site mode, and logs it', async () => {
    const c = await request(app).patch('/api/admin/settings').set(auth(cofounder.token)).send({ mode: 'public' });
    expect(c.statusCode).toBe(403);
    // The co-founder can still change content
    const msg = await request(app).patch('/api/admin/settings').set(auth(cofounder.token)).send({ announcement: 'Hello Jorhat' });
    expect(msg.statusCode).toBe(200);

    const f = await request(app).patch('/api/admin/settings').set(auth(founder.token)).send({ mode: 'maintenance' });
    expect(f.body.data.settings.mode).toBe('maintenance');
    expect((await request(app).get('/api/platform')).body.data).toMatchObject({ mode: 'maintenance', announcement: 'Hello Jorhat' });
    // The admin panel still works in maintenance mode
    expect((await request(app).get('/api/admin/overview').set(auth(cofounder.token))).statusCode).toBe(200);
    expect(await ActivityLog.exists({ action: 'settings.mode' })).toBeTruthy();
    await request(app).patch('/api/admin/settings').set(auth(founder.token)).send({ mode: 'waitlist' });
  });

  it('suspends and reactivates a user', async () => {
    const res = await request(app).patch(`/api/admin/users/${broker.id}`).set(auth(cofounder.token)).send({ isSuspended: true, reason: 'Fake listings' });
    expect(res.statusCode).toBe(200);
    expect((await request(app).get('/api/auth/me').set(auth(broker.token))).statusCode).toBe(403);
    const login = await request(app).post('/api/auth/login').send({ email: 'broker@admin.test', password: 'Password123!' });
    expect(login.statusCode).toBe(403);

    await request(app).patch(`/api/admin/users/${broker.id}`).set(auth(cofounder.token)).send({ isSuspended: false });
    expect((await request(app).post('/api/auth/login').send({ email: 'broker@admin.test', password: 'Password123!' })).statusCode).toBe(200);
  });

  it('stops admins changing their own account or suspending a configured admin', async () => {
    expect((await request(app).patch(`/api/admin/users/${founder.id}`).set(auth(founder.token)).send({ role: 'owner' })).statusCode).toBe(403);
    expect((await request(app).patch(`/api/admin/users/${founder.id}`).set(auth(cofounder.token)).send({ isSuspended: true })).statusCode).toBe(403);
  });

  it('only the founder grants admin access', async () => {
    expect((await request(app).patch(`/api/admin/users/${student.id}`).set(auth(cofounder.token)).send({ adminRole: 'cofounder' })).statusCode).toBe(403);
    const ok = await request(app).patch(`/api/admin/users/${student.id}`).set(auth(founder.token)).send({ adminRole: 'cofounder' });
    expect(ok.statusCode).toBe(200);
    expect((await request(app).get('/api/admin/me').set(auth(student.token))).body.data.adminRole).toBe('cofounder');
    await request(app).patch(`/api/admin/users/${student.id}`).set(auth(founder.token)).send({ adminRole: null });
    expect((await request(app).get('/api/admin/me').set(auth(student.token))).statusCode).toBe(403);
  });

  it('shows the waitlist, updates status and notes, and exports CSV', async () => {
    await request(app).post('/api/waitlist').send({ email: 'wait1@admin.test' });
    await request(app).post('/api/waitlist').send({ email: '=cmd@admin.test' });
    const list = await request(app).get('/api/admin/waitlist').set(auth(cofounder.token));
    expect(list.body.data.items.length).toBe(2);
    const entry = list.body.data.items.find((e) => e.email === 'wait1@admin.test');
    expect(entry.status).toBe('new');

    await request(app).patch(`/api/admin/waitlist/${entry._id}`).set(auth(cofounder.token)).send({ status: 'contacted', college: 'JEC' });
    await request(app).post(`/api/admin/waitlist/${entry._id}/notes`).set(auth(cofounder.token)).send({ text: 'Called, wants a single room' });
    const detail = await request(app).get(`/api/admin/waitlist/${entry._id}`).set(auth(founder.token));
    expect(detail.body.data.entry).toMatchObject({ status: 'contacted', college: 'JEC' });
    expect(detail.body.data.entry.notes[0].text).toBe('Called, wants a single room');

    const csv = await request(app).get('/api/admin/waitlist/export').set(auth(founder.token));
    expect(csv.headers['content-type']).toMatch(/text\/csv/);
    expect(csv.text).toContain('wait1@admin.test');
    expect(csv.text).toContain("'=cmd@admin.test"); // can't run as a spreadsheet formula
    expect((await request(app).get('/api/admin/waitlist/export').set(auth(student.token))).statusCode).toBe(403);
  });

  it('gives real numbers on the overview', async () => {
    const res = await request(app).get('/api/admin/overview').set(auth(founder.token));
    expect(res.statusCode).toBe(200);
    const { stats, charts } = res.body.data;
    expect(stats.totalListings).toBe(await PGListing.countDocuments({ isDeleted: { $ne: true } }));
    expect(stats.waitlistTotal).toBe(await WaitlistEntry.countDocuments());
    expect(stats.students).toBe(await User.countDocuments({ role: 'student' }));
    expect(charts.waitlistTrend).toHaveLength(30);
  });

  it('does not allow editing the activity log', async () => {
    await expect(ActivityLog.updateOne({}, { action: 'x' })).rejects.toThrow();
  });
});
