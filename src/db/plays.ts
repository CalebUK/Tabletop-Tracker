import { getDb } from './database';
import { Play, PlayPlayer } from '../types';

interface PlayRow {
  id: number;
  game_id: number;
  played_at: string;
  notes: string | null;
}

interface PlayPlayerRow {
  play_id: number;
  player_name: string;
  is_winner: number;
}

// Insert player + expansion rows for a play (shared by add and update).
async function writePlayChildren(
  db: Awaited<ReturnType<typeof getDb>>,
  playId: number,
  players: PlayPlayer[],
  expansionIds: number[]
): Promise<void> {
  for (const p of players) {
    const name = p.name.trim();
    if (!name) continue;
    await db.runAsync(
      'INSERT INTO play_players (play_id, player_name, is_winner) VALUES (?, ?, ?)',
      [playId, name, p.isWinner ? 1 : 0]
    );
  }
  for (const id of expansionIds) {
    await db.runAsync(
      'INSERT OR IGNORE INTO play_expansions (play_id, expansion_id) VALUES (?, ?)',
      [playId, id]
    );
  }
}

// All plays for a game, newest first, with players and used expansions.
export async function getPlaysForGame(gameId: number): Promise<Play[]> {
  const db = await getDb();
  const playRows = await db.getAllAsync<PlayRow>(
    'SELECT * FROM plays WHERE game_id = ? ORDER BY played_at DESC, id DESC',
    [gameId]
  );
  if (playRows.length === 0) return [];

  const playerRows = await db.getAllAsync<PlayPlayerRow>(
    `SELECT pp.play_id, pp.player_name, pp.is_winner
       FROM play_players pp
       JOIN plays p ON p.id = pp.play_id
      WHERE p.game_id = ?`,
    [gameId]
  );
  const expRows = await db.getAllAsync<{ play_id: number; name: string }>(
    `SELECT pe.play_id, e.name
       FROM play_expansions pe
       JOIN expansions e ON e.id = pe.expansion_id
       JOIN plays p ON p.id = pe.play_id
      WHERE p.game_id = ?`,
    [gameId]
  );

  const playersByPlay = new Map<number, PlayPlayer[]>();
  for (const r of playerRows) {
    const list = playersByPlay.get(r.play_id) ?? [];
    list.push({ name: r.player_name, isWinner: r.is_winner === 1 });
    playersByPlay.set(r.play_id, list);
  }
  const expsByPlay = new Map<number, string[]>();
  for (const r of expRows) {
    const list = expsByPlay.get(r.play_id) ?? [];
    list.push(r.name);
    expsByPlay.set(r.play_id, list);
  }

  return playRows.map((p) => ({
    id: p.id,
    gameId: p.game_id,
    playedAt: p.played_at,
    notes: p.notes,
    players: playersByPlay.get(p.id) ?? [],
    expansions: expsByPlay.get(p.id) ?? [],
    expansionIds: [],
  }));
}

export async function addPlay(
  gameId: number,
  playedAt: string,
  notes: string | null,
  players: PlayPlayer[],
  expansionIds: number[] = []
): Promise<number> {
  const db = await getDb();
  let playId = 0;
  await db.withTransactionAsync(async () => {
    const res = await db.runAsync(
      'INSERT INTO plays (game_id, played_at, notes) VALUES (?, ?, ?)',
      [gameId, playedAt, notes]
    );
    playId = res.lastInsertRowId;
    await writePlayChildren(db, playId, players, expansionIds);
  });
  return playId;
}

export async function getPlay(playId: number): Promise<Play | null> {
  const db = await getDb();
  const p = await db.getFirstAsync<PlayRow>('SELECT * FROM plays WHERE id = ?', [playId]);
  if (!p) return null;
  const players = await db.getAllAsync<PlayPlayerRow>(
    'SELECT play_id, player_name, is_winner FROM play_players WHERE play_id = ?',
    [playId]
  );
  const exps = await db.getAllAsync<{ expansion_id: number; name: string }>(
    `SELECT pe.expansion_id, e.name
       FROM play_expansions pe JOIN expansions e ON e.id = pe.expansion_id
      WHERE pe.play_id = ?`,
    [playId]
  );
  return {
    id: p.id,
    gameId: p.game_id,
    playedAt: p.played_at,
    notes: p.notes,
    players: players.map((r) => ({ name: r.player_name, isWinner: r.is_winner === 1 })),
    expansions: exps.map((e) => e.name),
    expansionIds: exps.map((e) => e.expansion_id),
  };
}

export async function updatePlay(
  playId: number,
  playedAt: string,
  notes: string | null,
  players: PlayPlayer[],
  expansionIds: number[] = []
): Promise<void> {
  const db = await getDb();
  await db.withTransactionAsync(async () => {
    await db.runAsync('UPDATE plays SET played_at = ?, notes = ? WHERE id = ?', [
      playedAt,
      notes,
      playId,
    ]);
    await db.runAsync('DELETE FROM play_players WHERE play_id = ?', [playId]);
    await db.runAsync('DELETE FROM play_expansions WHERE play_id = ?', [playId]);
    await writePlayChildren(db, playId, players, expansionIds);
  });
}

export async function deletePlay(playId: number): Promise<void> {
  const db = await getDb();
  await db.runAsync('DELETE FROM plays WHERE id = ?', [playId]);
}

// Distinct player names ever recorded, most-used first (for autocomplete).
export async function getAllPlayers(): Promise<string[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<{ name: string }>(
    `SELECT player_name AS name, count(*) AS c
       FROM play_players
      GROUP BY player_name COLLATE NOCASE
      ORDER BY c DESC, name COLLATE NOCASE ASC`
  );
  return rows.map((r) => r.name);
}

export interface PlayerStats {
  name: string;
  totalPlays: number;
  wins: number;
  winRate: number; // 0-100
  perGame: { name: string; plays: number; wins: number }[];
}

export async function getPlayerStats(name: string): Promise<PlayerStats> {
  const db = await getDb();
  const totals = await db.getFirstAsync<{ plays: number; wins: number }>(
    'SELECT count(*) AS plays, sum(is_winner) AS wins FROM play_players WHERE player_name = ? COLLATE NOCASE',
    [name]
  );
  const perGame = await db.getAllAsync<{ name: string; plays: number; wins: number }>(
    `SELECT g.name AS name, count(*) AS plays, sum(pp.is_winner) AS wins
       FROM play_players pp
       JOIN plays p ON p.id = pp.play_id
       JOIN games g ON g.id = p.game_id
      WHERE pp.player_name = ? COLLATE NOCASE
      GROUP BY g.id
      ORDER BY plays DESC, g.name COLLATE NOCASE ASC`,
    [name]
  );
  const plays = totals?.plays ?? 0;
  const wins = totals?.wins ?? 0;
  return {
    name,
    totalPlays: plays,
    wins,
    winRate: plays > 0 ? Math.round((wins / plays) * 100) : 0,
    perGame,
  };
}

// Aggregate stats for the Stats tab.
export interface CollectionStats {
  totalGames: number;
  totalPlays: number;
  favorites: number;
  unplayed: number;
  topPlayers: { name: string; wins: number; plays: number }[];
  mostPlayed: { name: string; plays: number }[];
}

export async function getStats(): Promise<CollectionStats> {
  const db = await getDb();
  const totals = await db.getFirstAsync<{
    total_games: number;
    favorites: number;
  }>('SELECT count(*) AS total_games, sum(is_favorite) AS favorites FROM games');
  const totalPlays = await db.getFirstAsync<{ c: number }>(
    'SELECT count(*) AS c FROM plays'
  );
  const unplayed = await db.getFirstAsync<{ c: number }>(
    'SELECT count(*) AS c FROM games g WHERE (SELECT count(*) FROM plays p WHERE p.game_id = g.id) = 0'
  );
  const topPlayers = await db.getAllAsync<{ name: string; wins: number; plays: number }>(
    `SELECT player_name AS name,
            sum(is_winner) AS wins,
            count(*) AS plays
       FROM play_players
      GROUP BY player_name COLLATE NOCASE
      ORDER BY wins DESC, plays DESC
      LIMIT 5`
  );
  const mostPlayed = await db.getAllAsync<{ name: string; plays: number }>(
    `SELECT g.name AS name, count(p.id) AS plays
       FROM games g JOIN plays p ON p.game_id = g.id
      GROUP BY g.id
      ORDER BY plays DESC
      LIMIT 5`
  );

  return {
    totalGames: totals?.total_games ?? 0,
    totalPlays: totalPlays?.c ?? 0,
    favorites: totals?.favorites ?? 0,
    unplayed: unplayed?.c ?? 0,
    topPlayers,
    mostPlayed,
  };
}
