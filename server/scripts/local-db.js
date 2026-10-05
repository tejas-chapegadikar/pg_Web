/**
 * Local MongoDB for development — nothing to install.
 *
 * Runs the MongoDB server binary that mongodb-memory-server downloads for the tests
 * (cached in node_modules/.cache) and keeps the data in server/.data/db, so listings
 * and accounts survive restarts. Point MONGO_URI at mongodb://127.0.0.1:27017/aneighar.
 *
 *   npm run db
 *
 * For a shared or deployed site use MongoDB Atlas instead.
 */
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const { MongoBinary } = require('mongodb-memory-server');

const DB_PATH = path.join(__dirname, '..', '.data', 'db');
const PORT = process.env.LOCAL_DB_PORT || '27017';

(async () => {
  fs.mkdirSync(DB_PATH, { recursive: true });
  const binary = await MongoBinary.getPath(); // downloads once if the cache is empty

  console.log(`Local MongoDB on mongodb://127.0.0.1:${PORT} — data in ${DB_PATH}`);
  const mongod = spawn(binary, ['--dbpath', DB_PATH, '--port', PORT, '--bind_ip', '127.0.0.1', '--quiet'], {
    stdio: ['ignore', 'ignore', 'inherit'],
  });
  mongod.on('exit', (code) => process.exit(code ?? 0));
  for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => mongod.kill(signal));
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
