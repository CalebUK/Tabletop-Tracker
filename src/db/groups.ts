import { getDb } from './database';
import { Group } from '../types';

export async function createGroup(name: string): Promise<number> {
  const db = await getDb();
  const res = await db.runAsync('INSERT INTO groups (name) VALUES (?)', [name.trim()]);
  return res.lastInsertRowId;
}

export async function getGroups(): Promise<Group[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<{ id: number; name: string }>(
    'SELECT id, name FROM groups ORDER BY name COLLATE NOCASE ASC'
  );
  return rows.map((r) => ({ id: r.id, name: r.name }));
}

// Deleting a group keeps its plays (group_id is set to NULL by the FK rule).
export async function deleteGroup(id: number): Promise<void> {
  const db = await getDb();
  await db.runAsync('DELETE FROM groups WHERE id = ?', [id]);
}

export interface GroupStats {
  name: string;
  totalPlays: number;
  players: { name: string; wins: number; plays: number }[];
  games: { name: string; plays: number; gameId: number | null }[];
}

export async function getGroupStats(groupId: number): Promise<GroupStats> {
  const db = await getDb();
  const g = await db.getFirstAsync<{ name: string }>('SELECT name FROM groups WHERE id = ?', [
    groupId,
  ]);
  const total = await db.getFirstAsync<{ c: number }>(
    'SELECT count(*) AS c FROM plays WHERE group_id = ?',
    [groupId]
  );
  const players = await db.getAllAsync<{ name: string; wins: number; plays: number }>(
    `SELECT pp.player_name AS name, sum(pp.is_winner) AS wins, count(*) AS plays
       FROM play_players pp
       JOIN plays p ON p.id = pp.play_id
      WHERE p.group_id = ?
      GROUP BY pp.player_name COLLATE NOCASE
      ORDER BY wins DESC, plays DESC`,
    [groupId]
  );
  const games = await db.getAllAsync<{ name: string; plays: number; gameId: number | null }>(
    `SELECT COALESCE(game_name, '(unknown)') AS name, count(*) AS plays,
            MAX(game_id) AS gameId
       FROM plays
      WHERE group_id = ?
      GROUP BY name COLLATE NOCASE
      ORDER BY plays DESC, name COLLATE NOCASE ASC`,
    [groupId]
  );
  return { name: g?.name ?? 'Group', totalPlays: total?.c ?? 0, players, games };
}
