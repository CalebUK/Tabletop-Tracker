import type * as SQLite from 'expo-sqlite';
import { getDb } from './database';
import { Complexity, Expansion, Game, GameInput, LoanRecord, SearchFilters } from '../types';

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
  bgg_weight: number | null;
  developer: string | null;
  min_age: number | null;
  complexity: string | null;
  edition: string | null;
  loaned_to: string | null;
  loaned_at: string | null;
  created_at: string;
  updated_at: string;
  tags: string | null; // group_concat result
  categories: string | null; // group_concat result
  play_count: number;
  expansion_count: number;
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
    bggWeight: row.bgg_weight,
    developer: row.developer,
    minAge: row.min_age,
    complexity: (row.complexity as Complexity) ?? null,
    edition: row.edition,
    loanedTo: row.loaned_to,
    loanedAt: row.loaned_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    tags: row.tags ? row.tags.split(TAG_SEP).filter(Boolean) : [],
    categories: row.categories ? row.categories.split(TAG_SEP).filter(Boolean) : [],
    playCount: row.play_count ?? 0,
    expansionCount: row.expansion_count ?? 0,
  };
}

const BASE_SELECT = `
  SELECT g.*,
    (SELECT group_concat(t.name, char(1))
       FROM game_tags gt JOIN tags t ON t.id = gt.tag_id
      WHERE gt.game_id = g.id) AS tags,
    (SELECT group_concat(c.name, char(1))
       FROM game_categories gc JOIN categories c ON c.id = gc.category_id
      WHERE gc.game_id = g.id) AS categories,
    (SELECT count(*) FROM plays p WHERE p.game_id = g.id) AS play_count,
    (SELECT count(*) FROM expansions e WHERE e.game_id = g.id) AS expansion_count
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
    // Effective max counts extra players from owned expansions, so a 1-6 game
    // with a "+2" expansion can satisfy an "8 players" search.
    const effMax =
      '(COALESCE(g.max_players, 0) + (SELECT COALESCE(SUM(e.additional_players), 0) FROM expansions e WHERE e.game_id = g.id))';
    if (filters.playerCount >= 7) {
      where.push(`${effMax} >= ?`);
      params.push(filters.playerCount);
    } else {
      where.push(`g.min_players <= ? AND ${effMax} >= ?`);
      params.push(filters.playerCount, filters.playerCount);
    }
  }
  if (filters.minRating != null) {
    where.push('g.rating IS NOT NULL AND g.rating >= ?');
    params.push(filters.minRating);
  }
  if (filters.minBggRating != null) {
    where.push('g.bgg_rating IS NOT NULL AND g.bgg_rating >= ?');
    params.push(filters.minBggRating);
  }
  if (filters.ageBands.length > 0) {
    // The band is the age of the player. Show every game that player could
    // play, i.e. the game's minimum age is at or below the band's top age.
    // The open-ended top band (12+) shows any age-rated game.
    const ors: string[] = [];
    for (const b of filters.ageBands) {
      if (b.hi != null) {
        ors.push('g.min_age <= ?');
        params.push(b.hi);
      } else {
        ors.push('1');
      }
    }
    where.push(`g.min_age IS NOT NULL AND (${ors.join(' OR ')})`);
  }
  if (filters.complexity != null) {
    where.push('g.complexity = ?');
    params.push(filters.complexity);
  }
  if (filters.category != null) {
    where.push(
      'EXISTS (SELECT 1 FROM game_categories gc JOIN categories c ON c.id = gc.category_id WHERE gc.game_id = g.id AND c.name = ? COLLATE NOCASE)'
    );
    params.push(filters.category);
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
           bgg_rating = ?, bgg_weight = ?, developer = ?, min_age = ?, complexity = ?, edition = ?,
           updated_at = datetime('now')
         WHERE id = ?`,
        [
          input.name, input.imageUri, input.location, input.year,
          input.minPlayers, input.maxPlayers, input.playTimeMin, input.rating,
          input.notes, input.houseRules, input.isFavorite ? 1 : 0, input.bggId,
          input.bggRating, input.bggWeight, input.developer, input.minAge, input.complexity,
          input.edition, input.id,
        ]
      );
      gameId = input.id;
    } else {
      const res = await db.runAsync(
        `INSERT INTO games
           (name, image_uri, location, year, min_players, max_players,
            play_time_min, rating, notes, house_rules, is_favorite,
            bgg_id, bgg_rating, bgg_weight, developer, min_age, complexity, edition)
         VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
        [
          input.name, input.imageUri, input.location, input.year,
          input.minPlayers, input.maxPlayers, input.playTimeMin, input.rating,
          input.notes, input.houseRules, input.isFavorite ? 1 : 0,
          input.bggId, input.bggRating, input.bggWeight, input.developer, input.minAge,
          input.complexity, input.edition,
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

    // Reconcile categories the same way as tags.
    await db.runAsync('DELETE FROM game_categories WHERE game_id = ?', [gameId]);
    for (const rawCat of input.categories) {
      const cat = rawCat.trim();
      if (!cat) continue;
      await db.runAsync('INSERT OR IGNORE INTO categories (name) VALUES (?)', [cat]);
      const catRow = await db.getFirstAsync<{ id: number }>(
        'SELECT id FROM categories WHERE name = ? COLLATE NOCASE',
        [cat]
      );
      if (catRow) {
        await db.runAsync(
          'INSERT OR IGNORE INTO game_categories (game_id, category_id) VALUES (?, ?)',
          [gameId, catRow.id]
        );
      }
    }

    // Reconcile expansions: clear and re-insert from the form.
    await db.runAsync('DELETE FROM expansions WHERE game_id = ?', [gameId]);
    for (const ex of input.expansions) {
      const name = ex.name.trim();
      if (!name) continue;
      await db.runAsync(
        'INSERT INTO expansions (game_id, name, additional_players) VALUES (?, ?, ?)',
        [gameId, name, ex.additionalPlayers || 0]
      );
    }
  });

  return gameId;
}

// How many other games share this name (case-insensitive)? Used to warn about
// accidental duplicates. excludeId skips the game being edited.
export async function countGamesByName(name: string, excludeId?: number): Promise<number> {
  const db = await getDb();
  const row = await db.getFirstAsync<{ c: number }>(
    'SELECT count(*) AS c FROM games WHERE name = ? COLLATE NOCASE AND id <> ?',
    [name.trim(), excludeId ?? -1]
  );
  return row?.c ?? 0;
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
export async function setLoan(
  id: number,
  loanedTo: string,
  loanedAt: string,
  photoUri?: string | null
): Promise<void> {
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
      await db.runAsync('UPDATE loans SET loaned_to = ?, loaned_at = ?, photo_uri = ? WHERE id = ?', [
        loanedTo,
        loanedAt,
        photoUri ?? null,
        open.id,
      ]);
    } else {
      await db.runAsync(
        'INSERT INTO loans (game_id, loaned_to, loaned_at, photo_uri) VALUES (?, ?, ?, ?)',
        [id, loanedTo, loanedAt, photoUri ?? null]
      );
    }
  });
}

// Mark a loaned game as returned: closes the open loan, clears the row, and
// returns the proof photo uri (if any) so the caller can delete the file.
// Optionally update the game's storage location (in case it moved shelves).
export async function returnLoan(
  id: number,
  newLocation?: string | null
): Promise<string | null> {
  const db = await getDb();
  const today = new Date().toISOString().slice(0, 10);
  const open = await db.getFirstAsync<{ photo_uri: string | null }>(
    'SELECT photo_uri FROM loans WHERE game_id = ? AND returned_at IS NULL ORDER BY id DESC LIMIT 1',
    [id]
  );
  await db.withTransactionAsync(async () => {
    // Drop the proof photo reference on return (the file is deleted by caller).
    await db.runAsync(
      'UPDATE loans SET returned_at = ?, photo_uri = NULL WHERE game_id = ? AND returned_at IS NULL',
      [today, id]
    );
    await db.runAsync('UPDATE games SET loaned_to = NULL, loaned_at = NULL WHERE id = ?', [id]);
    if (newLocation !== undefined) {
      await db.runAsync('UPDATE games SET location = ? WHERE id = ?', [
        newLocation && newLocation.trim() ? newLocation.trim() : null,
        id,
      ]);
    }
  });
  return open?.photo_uri ?? null;
}

// Full loan history for a game, most recent first.
export async function getLoanHistory(gameId: number): Promise<LoanRecord[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<{
    id: number;
    loaned_to: string;
    loaned_at: string;
    returned_at: string | null;
    photo_uri: string | null;
  }>(
    'SELECT id, loaned_to, loaned_at, returned_at, photo_uri FROM loans WHERE game_id = ? ORDER BY loaned_at DESC, id DESC',
    [gameId]
  );
  return rows.map((r) => ({
    id: r.id,
    loanedTo: r.loaned_to,
    loanedAt: r.loaned_at,
    returnedAt: r.returned_at,
    photoUri: r.photo_uri,
  }));
}

// Expansions owned for a game.
export async function getExpansions(gameId: number): Promise<Expansion[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<{ id: number; name: string; additional_players: number }>(
    'SELECT id, name, additional_players FROM expansions WHERE game_id = ? ORDER BY id ASC',
    [gameId]
  );
  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    additionalPlayers: r.additional_players,
  }));
}

// Lightweight game list for publishing to an online library (no photos).
export async function getGamesForLibrary(): Promise<
  { name: string; rating: number | null; minPlayers: number | null; maxPlayers: number | null; playTimeMin: number | null }[]
> {
  const db = await getDb();
  const rows = await db.getAllAsync<{
    name: string;
    rating: number | null;
    min_players: number | null;
    max_players: number | null;
    play_time_min: number | null;
  }>(
    'SELECT name, rating, min_players, max_players, play_time_min FROM games ORDER BY name COLLATE NOCASE ASC'
  );
  return rows.map((r) => ({
    name: r.name,
    rating: r.rating,
    minPlayers: r.min_players,
    maxPlayers: r.max_players,
    playTimeMin: r.play_time_min,
  }));
}

// Distinct storage locations in use, for the Collection location filter.
export async function getAllLocations(): Promise<string[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<{ location: string }>(
    "SELECT DISTINCT location FROM games WHERE location IS NOT NULL AND trim(location) <> '' ORDER BY location COLLATE NOCASE ASC"
  );
  return rows.map((r) => r.location);
}

// All distinct tag names in use, for filter chips and autocomplete.
export async function getAllTags(): Promise<string[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<{ name: string }>(
    'SELECT name FROM tags ORDER BY name COLLATE NOCASE ASC'
  );
  return rows.map((r) => r.name);
}

// All distinct category names in use, for the editor and the search dropdown.
export async function getAllCategories(): Promise<string[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<{ name: string }>(
    'SELECT name FROM categories ORDER BY name COLLATE NOCASE ASC'
  );
  return rows.map((r) => r.name);
}
