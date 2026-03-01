import Database from 'better-sqlite3'
import { app } from 'electron'
import { join } from 'path'

let db: Database.Database

const migrations: string[] = [
  // Migration 1: Initial schema
  `
  CREATE TABLE comic (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    author TEXT NOT NULL,
    image_path TEXT,
    directory TEXT NOT NULL UNIQUE
  );

  CREATE TABLE volume (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    comic_id INTEGER NOT NULL REFERENCES comic(id) ON DELETE CASCADE,
    number INTEGER NOT NULL,
    directory TEXT NOT NULL,
    file TEXT,
    UNIQUE(comic_id, number)
  );

  CREATE TABLE chapter (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    volume_id INTEGER NOT NULL REFERENCES volume(id) ON DELETE CASCADE,
    number INTEGER NOT NULL,
    type TEXT NOT NULL CHECK(type IN ('chapter', 'extra')),
    file TEXT NOT NULL,
    UNIQUE(volume_id, number, type)
  );
  `,
  // Migration 2: Add favorite column
  `ALTER TABLE comic ADD COLUMN favorite INTEGER NOT NULL DEFAULT 0;`,
  // Migration 3: Add mature column
  `ALTER TABLE comic ADD COLUMN is_mature INTEGER NOT NULL DEFAULT 0;`,
  // Migration 4: Rename is_mature to is_hidden + add settings table
  `
  ALTER TABLE comic RENAME COLUMN is_mature TO is_hidden;
  CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
  );
  `,
  // Migration 5: Import directory tracking
  `
  CREATE TABLE import_directory (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    path TEXT NOT NULL UNIQUE,
    hidden INTEGER NOT NULL DEFAULT 0
  );
  `
]

function applyMigrations(database: Database.Database): void {
  database.exec(`
    CREATE TABLE IF NOT EXISTS schema_version (
      version INTEGER NOT NULL
    );
  `)

  const row = database.prepare('SELECT version FROM schema_version').get() as
    | { version: number }
    | undefined
  const currentVersion = row?.version ?? 0

  for (let i = currentVersion; i < migrations.length; i++) {
    database.exec(migrations[i])
  }

  if (currentVersion === 0) {
    database.prepare('INSERT INTO schema_version (version) VALUES (?)').run(migrations.length)
  } else if (currentVersion < migrations.length) {
    database.prepare('UPDATE schema_version SET version = ?').run(migrations.length)
  }
}

export function initDb(): void {
  const dbPath = join(app.getPath('userData'), 'mindex.db')
  db = new Database(dbPath)
  db.pragma('journal_mode = WAL')
  db.pragma('foreign_keys = ON')
  applyMigrations(db)
}

export function getDb(): Database.Database {
  return db
}
