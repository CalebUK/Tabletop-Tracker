import type * as SQLite from 'expo-sqlite';
import { getDb } from './database';
import { Game, GameInput, LoanRecord, SearchFilters } from '../types';

// Separator used inside group_concat for tags (an unlikely-to-appear char).
const TAG_SEP = '';

// Raw row shape as it comes back from SQLite (snake_case + ints for bools).
interface GameRow {
  id: number;
  name: string;
  image_uri: string | null;
  location: string | null;
  year: number | null;
  min_players: number | null;
  max_players: number | null;
  play_time_min: number | null;
  rating: number | null;
  notes: string | null;
  house_rules: string | null;
  is_favorite: number;
  bgg_id: number | null;
  bgg_rating: number | null;
  developer: string | null;
  loaned_to: string | null;
  loaned_at: string | null;
  created_at: string;
  updated_at: string;
  tags: string | null; // group_concat result
  play_count: number;
}

function rowToGame(row: GameRow): Game {
  return {
    id: row.id,
    name: row.name,
    imageUri: row.image_uri,
    location: row.location,
    year: row.year,
    minPlayers: row.min_players,
    maxPlayers: row.max_players,
    playTimeMin: row.play_time_min,
    rating: row.rating,
    notes: row.notes,
    houseRules: row.house_rules,
    isFavorite: row.is_favorite === 1,
    bggId: row.bgg_id,
    bggRating: row.bgg_rating,
    developer: row.developer,
    loanedTo: row.loaned_to,
    loanedAt: row.loaned_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    tags: row.tags ? row.tags.split(TAG_SEP).filter(Boolean) : [],
    playCount: row.play_count ?? 0,
  };
}

const BASE_SELECT = `
  SELECT g.*,
    (SELECT group_concat(t.name, char(1))
       FROM game_tags gt JOIN tags t ON t.id = gt.tag_id
      WHERE gt.game_id = g.id) AS tags,
    (SELECT count(*) FROM plays p WHERE p.game_id = g.id) AS play_count
  FROM games g
`;

export async function getAllGames(): Promise<Game[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<GameRow>(`${BASE_SELECT} ORDER BY g.name COLLATE NOCASE ASC`);
  return rows.map(rowToGame);
}

export async function getGame(id: number): Promise<Game | null> {
  const db = await getDb();
  const row = await db.getFirstAsync<GameRow>(`${BASE_SELECT} WHERE g.id = ?`, [id]);
  return row ? rowToGame(row) : null;
}

export async function searchGames(filters: SearchFilters): Promise<Game[]> {
  const db = await getDb();
  const where: string[] = [];
  const params: SQLite.SQLiteBindValue[] = [];

  if (filters.text.trim()) {
    where.push('(g.name LIKE ? OR g.notes LIKE ? OR g.developer LIKE ?)');
    const like = `%${filters.text.trim()}%`;
    params.push(like, like, like);
  }
  if (filters.favoritesOnly) {
    where.push('g.is_favorite = 1');
  }
  if (filters.unplayedOnly) {
    where.push('(SELECT count(*) FROM plays p WHERE p.game_id = g.id) = 0');
  }
  if (filters.maxPlayTime != null) {
    where.push('g.play_time_min IS NOT NULL AND g.play_time_min <= ?');
    params.push(filters.maxPlayTime);
  }
  if (filters.minPlayTime != null) {
    where.push('g.play_time_min IS NOT NULL AND g.play_time_min >= ?');
    params.push(filters.minPlayTime);
  }
  if (filters.playerCount != null) {
    if (filters.playerCount >= 7) {
      // "7+" means the game supports at least this many players.
      where.push('g.max_players >= ?');
      params.push(filters.playerCount);
    } else {
      where.push('g.min_players <= ? AND g.max_players >= ?');
      params.push(filters.playerCount, filters.playerCount);
    }
  }
  for (const tag of filters.tags) {
    where.push(
      'EXISTS (SELECT 1 FROM game_tags gt JOIN tags t ON t.id = gt.tag_id WHERE gt.game_id = g.id AND t.name = ? COLLATE NOCASE)'
    );
    params.push(tag);
  }

  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const rows = await db.getAllAsync<GameRow>(
    `${BASE_SELECT} ${whereSql} ORDER BY g.name COLLATE NOCASE ASC`,
    params
  );
  return rows.map(rowToGame);
}

// Insert or update a game and reconcile its tags. Returns the game id.
export async function saveGame(input: GameInput): Promise<number> {
  const db = await getDb();
  let gameId = input.id ?? 0;

  await db.withTransactionAsync(async () => {
    if (input.id) {
      await db.runAsync(
        `UPDATE games SET
           name = ?, image_uri = ?, location = ?, year = ?,
           min_players = ?, max_players = ?, play_time_min = ?, rating = ?,
           notes = ?, house_rules = ?, is_favorite = ?, bgg_id = ?,
           bgg_rating = ?, developer = ?, updated_at = datetime('now')
         WHERE id = ?`,
        [
          input.name, input.imageUri, input.location, input.year,
          input.minPlayers, input.maxPlayers, input.playTimeMin, input.rating,
          input.notes, input.houseRules, input.isFavorite ? 1 : 0, input.bggId,
          input.bggRating, input.developer, input.id,
        ]
      );
      gameId = input.id;
    } else {
      const res = await db.runAsync(
        `INSERT INTO games
           (name, image_uri, location, year, min_players, max_players,
            play_time_min, rating, notes, house_rules, is_favorite,
            bgg_id, bgg_rating, developer)
         VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
        [
          input.name, input.imageUri, input.location, input.year,
          input.minPlayers, input.maxPlayers, input.playTimeMin, input.rating,
          input.notes, input.houseRules, input.isFavorite ? 1 : 0,
          input.bggId, input.bggRating, input.developer,
        ]
      );
      gameId = res.lastInsertRowId;
    }

    // Reconcile tags: ensure each exists, then reset the join rows.
    await db.runAsync('DELETE FROM game_tags WHERE game_id = ?', [gameId]);
    for (const rawTag of input.tags) {
      const tag = rawTag.trim();
      if (!tag) continue;
      await db.runAsync('INSERT OR IGNORE INTO tags (name) VALUES (?)', [tag]);
      const tagRow = await db.getFirstAsync<{ id: number }>(
        'SELECT id FROM tags WHERE name = ? COLLATE NOCASE',
        [tag]
      );
      if (tagRow) {
        await db.runAsync(
          'INSERT OR IGNORE INTO game_tags (game_id, tag_id) VALUES (?, ?)',
          [gameId, tagRow.id]
        );
      }
    }
  });

  return gameId;
}

export async function deleteGame(id: number): Promise<void> {
  const db = await getDb();
  await db.runAsync('DELETE FROM games WHERE id = ?', [id]);
}

export async function toggleFavorite(id: number, value: boolean): Promise<void> {
  const db = await getDb();
  await db.runAsync('UPDATE games SET is_favorite = ? WHERE id = ?', [value ? 1 : 0, id]);
}

// Mark a game as loaned out. loanedAt is an ISO date (YYYY-MM-DD). The current
// loan is mirrored onto the games row (for cards/search) and recorded in the
// loans history table.
export async function setLoan(id: number, loanedTo: string, loanedAt: string): Promise<void> {
  const db = await getDb();
  await db.withTransactionAsync(async () => {
    await db.runAsync('UPDATE games SET loaned_to = ?, loaned_at = ? WHERE id = ?', [
      loanedTo,
      loanedAt,
      id,
    ]);
    // If a loan is already open, update it in place; otherwise start a new one.
    const open = await db.getFirstAsync<{ id: number }>(
      'SELECT id FROM loans WHERE game_id = ? AND returned_at IS NULL ORDER BY id DESC LIMIT 1',
      [id]
    );
    if (open) {
      await db.runAsync('UPDATE loans SET loaned_to = ?, loaned_at = ? WHERE id = ?', [
        loanedTo,
        loanedAt,
        open.id,
      ]);
    } else {
      await db.runAsync(
        'INSERT INTO loans (game_id, loaned_to, loaned_at) VALUES (?, ?, ?)',
        [id, loanedTo, loanedAt]
      );
    }
  });
}

// Mark a loaned game as returned: closes the open loan and clears the row.
export async function returnLoan(id: number): Promise<void> {
  const db = await getDb();
  const today = new Date().toISOString().slice(0, 10);
  await db.withTransactionAsync(async () => {
    await db.runAsync(
      'UPDATE loans SET returned_at = ? WHERE game_id = ? AND returned_at IS NULL',
      [today, id]
    );
    await db.runAsync('UPDATE games SET loaned_to = NULL, loaned_at = NULL WHERE id = ?', [id]);
  });
}

// Full loan history for a game, most recent first.
export async function getLoanHistory(gameId: number): Promise<LoanRecord[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<{
    id: number;
    loaned_to: string;
    loaned_at: string;
    returned_at: string | null;
  }>(
    'SELECT id, loaned_to, loaned_at, returned_at FROM loans WHERE game_id = ? ORDER BY loaned_at DESC, id DESC',
    [gameId]
  );
  return rows.map((r) => ({
    id: r.id,
    loanedTo: r.loaned_to,
    loanedAt: r.loaned_at,
    returnedAt: r.returned_at,
  }));
}

// All distinct tag names in use, for filter chips and autocomplete.
export async function getAllTags(): Promise<string[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<{ name: string }>(
    'SELECT name FROM tags ORDER BY name COLLATE NOCASE ASC'
  );
  return rows.map((r) => r.name);
}
