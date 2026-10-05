const fs = require('fs');
const os = require('os');
const path = require('path');

// Save test photos in a throwaway folder (read when the modules below are loaded)
const UPLOADS_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'aneighar-uploads-'));
process.env.UPLOADS_DIR = UPLOADS_DIR;

const request = require('supertest');
const app = require('../app');
const { registerUser } = require('./auth.helper');

// Smallest valid PNG (1×1)
const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=',
  'base64'
);

describe('Listing photos without Cloudinary (local disk)', () => {
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

  afterAll(() => fs.rmSync(UPLOADS_DIR, { recursive: true, force: true }));

  it('saves an upload to disk and serves it', async () => {
    const res = await request(app)
      .post(`/api/pg/${pgId}/images`)
      .set('Authorization', `Bearer ${token}`)
      .attach('images', PNG, { filename: 'room.png', contentType: 'image/png' });
    expect(res.statusCode).toBe(200);

    const [img] = res.body.data.pg.images;
    expect(img.url).toMatch(/^\/api\/uploads\/[a-f0-9]{24}\.png$/);
    expect(img.publicId).toMatch(/^local\//);

    const served = await request(app).get(img.url);
    expect(served.statusCode).toBe(200);
    expect(served.headers['content-type']).toBe('image/png');
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
    const { publicId, url } = pg.images[0];
    const file = path.join(UPLOADS_DIR, path.basename(url));
    expect(fs.existsSync(file)).toBe(true);

    // Another broker can't delete it
    const other = await request(app)
      .delete(`/api/pg/${pgId}/images/${encodeURIComponent(publicId)}`)
      .set('Authorization', `Bearer ${otherToken}`);
    expect(other.statusCode).toBe(404);

    // An id that isn't on this listing is refused
    const stranger = await request(app)
      .delete(`/api/pg/${pgId}/images/${encodeURIComponent('local/not-mine.png')}`)
      .set('Authorization', `Bearer ${token}`);
    expect(stranger.statusCode).toBe(404);

    const res = await request(app)
      .delete(`/api/pg/${pgId}/images/${encodeURIComponent(publicId)}`)
      .set('Authorization', `Bearer ${token}`);
    expect(res.statusCode).toBe(200);
    expect(res.body.data.pg.images).toHaveLength(0);
    expect(fs.existsSync(file)).toBe(false);
  });

  it('refuses local storage in production', async () => {
    process.env.NODE_ENV = 'production';
    const res = await request(app)
      .post(`/api/pg/${pgId}/images`)
      .set('Authorization', `Bearer ${token}`)
      .attach('images', PNG, { filename: 'room.png', contentType: 'image/png' });
    process.env.NODE_ENV = 'test';
    expect(res.statusCode).toBe(503);
  });
});
