import Database from 'better-sqlite3';
import path from 'path';

const dbPath = path.resolve(process.cwd(), 'database.sqlite');
const db = new Database(dbPath);

// Enable WAL mode for better concurrency and performance
db.pragma('journal_mode = WAL');

// Ensure tables exist
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    name TEXT,
    email TEXT UNIQUE,
    passwordHash TEXT,
    createdAt TEXT,
    analysisCount INTEGER DEFAULT 0,
    itemsSaved INTEGER DEFAULT 0,
    co2Saved REAL DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS sessions (
    sessionId TEXT PRIMARY KEY,
    userId TEXT,
    createdAt TEXT,
    updatedAt TEXT,
    conversationHistory TEXT,
    visualAnalyses TEXT,
    currentRepairStep INTEGER,
    selectedOption TEXT,
    itemDescription TEXT,
    status TEXT
  );
`);

export default db;
