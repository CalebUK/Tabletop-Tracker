import * as SQLite from 'expo-sqlite';

// Single shared connection. Opened once and reused everywhere.
let dbPromise: Promise<SQLite.SQLiteDatabase> | null = null;

const SCHEMA = `
PRAGMA journal_mode = WAL;
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS games (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  image_uri TEXT,
  location TEXT,
  year INTEGER,
  min_players INTEGER,
  max_players INTEGER,
  play_time_min INTEGER,
  rating REAL,
  notes TEXT,
  house_rules TEXT,
  is_favorite INTEGER NOT NULL DEFAULT 0,
  bgg_id INTEGER,
  bgg_rating REAL,
  developer TEXT,
  loaned_to TEXT,
  loaned_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS tags (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE COLLATE NOCASE
);

CREATE TABLE IF NOT EXISTS game_tags (
  game_id INTEGER NOT NULL,
  tag_id INTEGER NOT NULL,
  PRIMARY KEY (game_id, tag_id),
  FOREIGN KEY (game_id) REFERENCES games(id) ON DELETE CASCADE,
  FOREIGN KEY (tag_id) REFERENCES tags(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS plays (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  game_id INTEGER NOT NULL,
  played_at TEXT NOT NULL,
  notes TEXT,
  FOREIGN KEY (game_id) REFERENCES games(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS play_players (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  play_id INTEGER NOT NULL,
  player_name TEXT NOT NULL,
  is_winner INTEGER NOT NULL DEFAULT 0,
  FOREIGN KEY (play_id) REFERENCES plays(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS loans (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  game_id INTEGER NOT NULL,
  loaned_to TEXT NOT NULL,
  loaned_at TEXT NOT NULL,   -- ISO date the game went out
  returned_at TEXT,          -- ISO date it came back; NULL while still out
  FOREIGN KEY (game_id) REFERENCES games(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS expansions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  game_id INTEGER NOT NULL,
  name TEXT NOT NULL,
  additional_players INTEGER NOT NULL DEFAULT 0,
  FOREIGN KEY (game_id) REFERENCES games(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_game_tags_game ON game_tags(game_id);
CREATE INDEX IF NOT EXISTS idx_game_tags_tag ON game_tags(tag_id);
CREATE INDEX IF NOT EXISTS idx_plays_game ON plays(game_id);
CREATE INDEX IF NOT EXISTS idx_play_players_play ON play_players(play_id);
CREATE INDEX IF NOT EXISTS idx_loans_game ON loans(game_id);
CREATE INDEX IF NOT EXISTS idx_expansions_game ON expansions(game_id);
`;

// Patch databases created by an earlier schema version. CREATE TABLE above
// already gives fresh installs the latest shape, so these only fire for
// upgrades from a previous build.
async function migrate(db: SQLite.SQLiteDatabase): Promise<void> {
  const cols = await db.getAllAsync<{ name: string }>('PRAGMA table_info(games)');
  const names = new Set(cols.map((c) => c.name));

  // designer -> developer rename (SQLite 3.25+ supports RENAME COLUMN).
  if (names.has('designer') && !names.has('developer')) {
    await db.execAsync('ALTER TABLE games RENAME COLUMN designer TO developer');
  }
  if (!names.has('loaned_to')) {
    await db.execAsync('ALTER TABLE games ADD COLUMN loaned_to TEXT');
  }
  if (!names.has('loaned_at')) {
    await db.execAsync('ALTER TABLE games ADD COLUMN loaned_at TEXT');
  }

  // Versioned migrations for changes that can't be detected by column presence.
  const row = await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version');
  const version = row?.user_version ?? 0;

  // v1: personal ratings moved from a 0-5 scale to 0-10 (to match BGG).
  // Double existing ratings once so old data keeps its meaning.
  if (version < 1) {
    await db.execAsync('UPDATE games SET rating = MIN(rating * 2, 10) WHERE rating IS NOT NULL');
    await db.execAsync('PRAGMA user_version = 1');
  }
}

export async function getDb(): Promise<SQLite.SQLiteDatabase> {
  if (!dbPromise) {
    dbPromise = (async () => {
      const db = await SQLite.openDatabaseAsync('bgk.db');
      await db.execAsync(SCHEMA);
      await migrate(db);
      return db;
    })();
  }
  return dbPromise;
}
