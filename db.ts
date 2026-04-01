import Database from 'better-sqlite3';
import path from 'path';

const dbPath = path.join(process.cwd(), 'database.sqlite');
const db = new Database(dbPath);

// Initialize tables
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    email TEXT UNIQUE NOT NULL,
    password TEXT,
    displayName TEXT,
    balance REAL DEFAULT 0,
    discount REAL DEFAULT 0,
    role TEXT DEFAULT 'user',
    createdAt DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS transactions (
    id TEXT PRIMARY KEY,
    userId TEXT NOT NULL,
    amount REAL NOT NULL,
    type TEXT NOT NULL,
    status TEXT NOT NULL,
    description TEXT,
    createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (userId) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS proxies (
    id TEXT PRIMARY KEY,
    userId TEXT NOT NULL,
    ip TEXT,
    port INTEGER,
    username TEXT,
    password TEXT,
    type TEXT,
    expiresAt DATETIME,
    createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (userId) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT
  );
`);

// Seed default settings
const seedSettings = db.prepare('INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)');
seedSettings.run('priceMarkup', '0');
seedSettings.run('announcement', 'Chào mừng bạn đến với hệ thống Proxy chất lượng cao!');
seedSettings.run('showAnnouncement', 'false');
seedSettings.run('contactEmail', 'support@proxypro.vn');
seedSettings.run('contactTelegram', '@proxypro_support');
seedSettings.run('contactPhone', '0123456789');

export default db;
