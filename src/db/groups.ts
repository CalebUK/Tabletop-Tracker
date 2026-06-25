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

export async function renameGroup(id: number, name: string): Promise<void> {
  const db = await getDb();
  await db.runAsync('UPDATE groups SET name = ? WHERE id = ?', [name.trim(), id]);
}

// Deleting a group keeps its plays (group_id is set to NULL by the FK rule).
export async function deleteGroup(id: number): Promise<void> {
  const db = await getDb();
  await db.runAsync('DELETE FROM groups WHERE id = ?', [id]);
}

// --- Members (the group's roster) ---

export async function getGroupMembers(groupId: number): Promise<string[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<{ name: string }>(
    'SELECT name FROM group_members WHERE group_id = ? ORDER BY id ASC',
    [groupId]
  );
  return rows.map((r) => r.name);
}

export async function addGroupMember(groupId: number, name: string): Promise<void> {
  const trimmed = name.trim();
  if (!trimmed) return;
  const db = await getDb();
  // Avoid duplicates (case-insensitive) within the group.
  const existing = await db.getFirstAsync<{ id: number }>(
    'SELECT id FROM group_members WHERE group_id = ? AND name = ? COLLATE NOCASE',
    [groupId, trimmed]
  );
  if (existing) return;
  await db.runAsync('INSERT INTO group_members (group_id, name) VALUES (?, ?)', [groupId, trimmed]);
}

// Members with their ids, for an editable list.
export async function getGroupMemberRows(groupId: number): Promise<{ id: number; name: string }[]> {
  const db = await getDb();
  return db.getAllAsync<{ id: number; name: string }>(
    'SELECT id, name FROM group_members WHERE group_id = ? ORDER BY id ASC',
    [groupId]
  );
}

export async function updateGroupMember(id: number, name: string): Promise<void> {
  const trimmed = name.trim();
  if (!trimmed) return;
  const db = await getDb();
  await db.runAsync('UPDATE group_members SET name = ? WHERE id = ?', [trimmed, id]);
}

export async function deleteGroupMember(id: number): Promise<void> {
  const db = await getDb();
  await db.runAsync('DELETE FROM group_members WHERE id = ?', [id]);
}

export async function setGroupAutofill(groupId: number, value: boolean): Promise<void> {
  const db = await getDb();
  await db.runAsync('UPDATE groups SET autofill = ? WHERE id = ?', [value ? 1 : 0, groupId]);
}

// Members + autofill flag, for prefilling the players when logging a play.
export async function getGroupRoster(
  groupId: number
): Promise<{ autofill: boolean; members: string[] }> {
  const db = await getDb();
  const row = await db.getFirstAsync<{ autofill: number }>(
    'SELECT autofill FROM groups WHERE id = ?',
    [groupId]
  );
  return { autofill: row?.autofill === 1, members: await getGroupMembers(groupId) };
}

export interface GroupStats {
  name: string;
  totalPlays: number;
  autofill: boolean;
  members: string[];
  players: { name: string; wins: number; plays: number }[]; // top 5
  playerCount: number;
  games: { name: string; plays: number; gameId: number | null }[]; // top 5
  gameCount: number;
}

export interface GroupPlay {
  id: number;
  gameName: string;
  playedAt: string;
  status: string; // 'completed' | 'dnf'
  winners: string; // comma-joined winner names (may be empty)
}

// Every play logged to the group (newest first), for an editable log list.
export async function getGroupPlays(groupId: number): Promise<GroupPlay[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<{
    id: number;
    game_name: string | null;
    played_at: string;
    status: string;
    winners: string | null;
  }>(
    `SELECT p.id AS id,
            COALESCE(p.game_name, (SELECT name FROM games WHERE id = p.game_id), '(game)') AS game_name,
            p.played_at AS played_at,
            p.status AS status,
            (SELECT group_concat(pp.player_name, ', ') FROM play_players pp
              WHERE pp.play_id = p.id AND pp.is_winner = 1) AS winners
       FROM plays p
      WHERE p.group_id = ? AND p.status != 'saved'
      ORDER BY p.played_at DESC, p.id DESC`,
    [groupId]
  );
  return rows.map((r) => ({
    id: r.id,
    gameName: r.game_name ?? '(game)',
    playedAt: r.played_at,
    status: r.status,
    winners: r.winners ?? '',
  }));
}

// Full group leaderboards (no limit) for the "see all" screens.
export async function getGroupPlayerRankings(
  groupId: number
): Promise<{ name: string; wins: number; plays: number }[]> {
  const db = await getDb();
  return db.getAllAsync(
    `SELECT pp.player_name AS name, sum(pp.is_winner) AS wins, count(*) AS plays
       FROM play_players pp JOIN plays p ON p.id = pp.play_id
      WHERE p.group_id = ? AND p.status != 'saved'
      GROUP BY pp.player_name COLLATE NOCASE
      ORDER BY wins DESC, plays DESC, name COLLATE NOCASE ASC`,
    [groupId]
  );
}

export async function getGroupGameRankings(
  groupId: number
): Promise<{ name: string; plays: number; gameId: number | null }[]> {
  const db = await getDb();
  return db.getAllAsync(
    `SELECT COALESCE(game_name, '(unknown)') AS name, count(*) AS plays, MAX(game_id) AS gameId
       FROM plays
      WHERE group_id = ? AND status != 'saved'
      GROUP BY name COLLATE NOCASE
      ORDER BY plays DESC, name COLLATE NOCASE ASC`,
    [groupId]
  );
}

export async function getGroupStats(groupId: number): Promise<GroupStats> {
  const db = await getDb();
  const g = await db.getFirstAsync<{ name: string; autofill: number }>(
    'SELECT name, autofill FROM groups WHERE id = ?',
    [groupId]
  );
  const total = await db.getFirstAsync<{ c: number }>(
    "SELECT count(*) AS c FROM plays WHERE group_id = ? AND status != 'saved'",
    [groupId]
  );
  const players = await db.getAllAsync<{ name: string; wins: number; plays: number }>(
    `SELECT pp.player_name AS name, sum(pp.is_winner) AS wins, count(*) AS plays
       FROM play_players pp
       JOIN plays p ON p.id = pp.play_id
      WHERE p.group_id = ? AND p.status != 'saved'
      GROUP BY pp.player_name COLLATE NOCASE
      ORDER BY wins DESC, plays DESC
      LIMIT 5`,
    [groupId]
  );
  const playerCount = await db.getFirstAsync<{ c: number }>(
    `SELECT count(DISTINCT pp.player_name COLLATE NOCASE) AS c
       FROM play_players pp JOIN plays p ON p.id = pp.play_id
      WHERE p.group_id = ? AND p.status != 'saved'`,
    [groupId]
  );
  const games = await db.getAllAsync<{ name: string; plays: number; gameId: number | null }>(
    `SELECT COALESCE(game_name, '(unknown)') AS name, count(*) AS plays,
            MAX(game_id) AS gameId
       FROM plays
      WHERE group_id = ? AND status != 'saved'
      GROUP BY name COLLATE NOCASE
      ORDER BY plays DESC, name COLLATE NOCASE ASC
      LIMIT 5`,
    [groupId]
  );
  const gameCount = await db.getFirstAsync<{ c: number }>(
    `SELECT count(*) AS c FROM (
       SELECT DISTINCT COALESCE(game_name, '(unknown)') COLLATE NOCASE AS n
         FROM plays WHERE group_id = ? AND status != 'saved')`,
    [groupId]
  );
  return {
    name: g?.name ?? 'Group',
    totalPlays: total?.c ?? 0,
    autofill: g?.autofill === 1,
    members: await getGroupMembers(groupId),
    players,
    playerCount: playerCount?.c ?? 0,
    games,
    gameCount: gameCount?.c ?? 0,
  };
}
