const request = require('supertest');
const app = require('../app');
const ImageFile = require('../models/ImageFile');
const { registerUser } = require('./auth.helper');

// Smallest valid PNG (1×1)
const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=',
  'base64'
);

describe('Listing photos without Cloudinary (kept in MongoDB)', () => {
  let token;
  let otherToken;
  let pgId;

  beforeAll(async () => {
    ['CLOUDINARY_CLOUD_NAME', 'CLOUDINARY_API_KEY', 'CLOUDINARY_API_SECRET'].forEach((k) => delete process.env[k]);

    token = (await registerUser(app, {
      name: 'Owner', email: 'photos@test.com', password: 'password123', role: 'owner',
    })).body.data.accessToken;
    otherToken = (await registerUser(app, {
      name: 'Other', email: 'other@test.com', password: 'password123', role: 'owner',
    })).body.data.accessToken;

    pgId = (await request(app).post('/api/pg').set('Authorization', `Bearer ${token}`).send({
      title: 'Photo PG', description: 'A description that is long enough to pass',
      location: { address: '1 Road', city: 'jorhat', state: 'Assam', pincode: '785001' },
      rent: 5000, deposit: 0, genderPreference: 'any', roomType: 'single', totalRooms: 2, availableRooms: 1,
    })).body.data.pg._id;
  });

  it('saves an upload in the database and serves it, in production too', async () => {
    process.env.NODE_ENV = 'production'; // the live site has no disk to write to
    const res = await request(app)
      .post(`/api/pg/${pgId}/images`)
      .set('Authorization', `Bearer ${token}`)
      .attach('images', PNG, { filename: 'room.png', contentType: 'image/png' });
    process.env.NODE_ENV = 'test';
    expect(res.statusCode).toBe(200);

    const [img] = res.body.data.pg.images;
    expect(img.url).toMatch(/^\/api\/uploads\/[a-f0-9]{24}$/);
    expect(img.publicId).toMatch(/^db\//);

    const served = await request(app).get(img.url);
    expect(served.statusCode).toBe(200);
    expect(served.headers['content-type']).toBe('image/png');
    expect(served.headers['cache-control']).toContain('immutable');
    expect(Buffer.compare(served.body, PNG)).toBe(0);
  });

  it('answers 404 for unknown or malformed photo ids', async () => {
    expect((await request(app).get('/api/uploads/0123456789abcdef01234567')).statusCode).toBe(404);
    expect((await request(app).get('/api/uploads/not-an-id')).statusCode).toBe(404);
  });

  it('refuses SVGs and other types', async () => {
    const res = await request(app)
      .post(`/api/pg/${pgId}/images`)
      .set('Authorization', `Bearer ${token}`)
      .attach('images', Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"></svg>'), {
        filename: 'x.svg', contentType: 'image/svg+xml',
      });
    expect(res.statusCode).toBe(400);
  });

  it('only lets the owner delete photos that belong to the listing', async () => {
    const pg = (await request(app).get(`/api/pg/${pgId}`)).body.data.pg;
    const { publicId } = pg.images[0];
    const imageId = publicId.slice('db/'.length);
    expect(await ImageFile.exists({ _id: imageId })).toBeTruthy();

    // Another broker can't delete it
    const other = await request(app)
      .delete(`/api/pg/${pgId}/images/${encodeURIComponent(publicId)}`)
      .set('Authorization', `Bearer ${otherToken}`);
    expect(other.statusCode).toBe(404);

    // An id that isn't on this listing is refused
    const stranger = await request(app)
      .delete(`/api/pg/${pgId}/images/${encodeURIComponent('db/0123456789abcdef01234567')}`)
      .set('Authorization', `Bearer ${token}`);
    expect(stranger.statusCode).toBe(404);

    const res = await request(app)
      .delete(`/api/pg/${pgId}/images/${encodeURIComponent(publicId)}`)
      .set('Authorization', `Bearer ${token}`);
    expect(res.statusCode).toBe(200);
    expect(res.body.data.pg.images).toHaveLength(0);
    expect(await ImageFile.exists({ _id: imageId })).toBeFalsy();
  });
});
