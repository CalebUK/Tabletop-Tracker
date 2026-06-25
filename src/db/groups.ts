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
  players: { name: string; wins: number; plays: number }[];
  games: { name: string; plays: number; gameId: number | null }[];
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
      ORDER BY wins DESC, plays DESC`,
    [groupId]
  );
  const games = await db.getAllAsync<{ name: string; plays: number; gameId: number | null }>(
    `SELECT COALESCE(game_name, '(unknown)') AS name, count(*) AS plays,
            MAX(game_id) AS gameId
       FROM plays
      WHERE group_id = ? AND status != 'saved'
      GROUP BY name COLLATE NOCASE
      ORDER BY plays DESC, name COLLATE NOCASE ASC`,
    [groupId]
  );
  return {
    name: g?.name ?? 'Group',
    totalPlays: total?.c ?? 0,
    autofill: g?.autofill === 1,
    members: await getGroupMembers(groupId),
    players,
    games,
  };
}
