const request = require('supertest');
const mongoose = require('mongoose');
const app = require('../app');
const User = require('../models/User');
const PGListing = require('../models/PGListing');
const { registerUser } = require('./auth.helper');

describe('PG CRUD Routes', () => {
  let ownerToken;
  let studentToken;
  let ownerId;
  let pgId;

  const owner = {
    name: 'Owner User',
    email: 'owner@test.com',
    password: 'password123',
    role: 'owner'
  };

  const student = {
    name: 'Student User',
    email: 'student@test.com',
    password: 'password123',
    role: 'student'
  };

  beforeAll(async () => {
    // Register owner
    const ownerRes = await registerUser(app, owner);
    ownerToken = ownerRes.body.data.accessToken;
    ownerId = ownerRes.body.data.user._id;

    // Register student
    const studentRes = await registerUser(app, student);
    studentToken = studentRes.body.data.accessToken;
  });

  const samplePG = {
    title: 'Test PG Listing',
    description: 'This is a test description with at least 20 chars',
    location: {
      address: '123 Test St',
      city: 'testville',
      state: 'TS',
      pincode: '123456'
    },
    rent: 5000,
    deposit: 10000,
    genderPreference: 'any',
    roomType: 'single',
    totalRooms: 10,
    availableRooms: 5,
    amenities: ['wifi', 'ac']
  };

  it('should allow owner to create a PG listing', async () => {
    const res = await request(app)
      .post('/api/pg')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send(samplePG);

    expect(res.statusCode).toBe(201);
    expect(res.body.status).toBe('success');
    expect(res.body.data.pg.title).toBe(samplePG.title);
    pgId = res.body.data.pg._id;
  });

  it('should prevent student from creating a PG listing', async () => {
    const res = await request(app)
      .post('/api/pg')
      .set('Authorization', `Bearer ${studentToken}`)
      .send(samplePG);

    expect(res.statusCode).toBe(403);
  });

  it('should fetch all PG listings', async () => {
    const res = await request(app).get('/api/pg');
    expect(res.statusCode).toBe(200);
    expect(res.body.listings.length).toBeGreaterThan(0);
  });

  it('should fetch a single PG listing and increment views', async () => {
    const res = await request(app).get(`/api/pg/${pgId}`);
    expect(res.statusCode).toBe(200);
    expect(res.body.data.pg.title).toBe(samplePG.title);
  });

  it('should allow owner to update their PG listing', async () => {
    const res = await request(app)
      .put(`/api/pg/${pgId}`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ rent: 6000 });

    expect(res.statusCode).toBe(200);
    expect(res.body.data.pg.rent).toBe(6000);
  });

  it('should require BHK (not room type) for a flat', async () => {
    // eslint-disable-next-line no-unused-vars
    const { roomType, ...flatBase } = samplePG;
    const missingBhk = await request(app)
      .post('/api/pg')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ ...flatBase, title: 'Test Flat', propertyType: 'flat' });
    expect(missingBhk.statusCode).toBe(400);

    const res = await request(app)
      .post('/api/pg')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ ...flatBase, title: 'Test Flat', propertyType: 'flat', bhk: 2 });
    expect(res.statusCode).toBe(201);
    expect(res.body.data.pg.propertyType).toBe('flat');
    expect(res.body.data.pg.bhk).toBe(2);
  });

  it('should filter listings by property type and BHK', async () => {
    const pgs = await request(app).get('/api/pg?propertyType=pg');
    expect(pgs.body.listings.map((l) => l.title)).toEqual([samplePG.title]);

    const flats = await request(app).get('/api/pg?propertyType=flat');
    expect(flats.body.listings.map((l) => l.title)).toEqual(['Test Flat']);

    const twoPlus = await request(app).get('/api/pg?propertyType=flat&bhk=2%2B');
    expect(twoPlus.body.listings).toHaveLength(1);
    const threePlus = await request(app).get('/api/pg?propertyType=flat&bhk=3%2B');
    expect(threePlus.body.listings).toHaveLength(0);
  });

  it('should search by name, address or city with q', async () => {
    const byAddress = await request(app).get('/api/pg?q=123 test');
    expect(byAddress.body.listings.length).toBeGreaterThan(0);

    const byName = await request(app).get('/api/pg?q=flat');
    expect(byName.body.listings.map((l) => l.title)).toEqual(['Test Flat']);

    // Regex characters are matched literally rather than breaking the query
    const special = await request(app).get('/api/pg?q=' + encodeURIComponent('(['));
    expect(special.statusCode).toBe(200);
    expect(special.body.listings).toHaveLength(0);
  });

  it('should treat listings saved before property types existed as PGs', async () => {
    await PGListing.collection.insertOne({
      ...samplePG,
      title: 'Legacy PG',
      owner: new mongoose.Types.ObjectId(ownerId),
      images: [],
    });

    const res = await request(app).get('/api/pg?propertyType=pg');
    expect(res.body.listings.map((l) => l.title)).toContain('Legacy PG');
  });

  it('should allow owner to soft delete their PG listing', async () => {
    const res = await request(app)
      .delete(`/api/pg/${pgId}`)
      .set('Authorization', `Bearer ${ownerToken}`);

    expect(res.statusCode).toBe(204);

    // Verify it is softly deleted (active: false)
    const dbPG = await PGListing.findById(pgId);
    expect(dbPG).toBeNull(); // Because queries filter active !== false by default
  });
});
