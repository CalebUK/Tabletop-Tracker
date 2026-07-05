import { getDb } from './database';
import { getMeta, setMeta } from './meta';

const MY_CODE = 'library_code';
const MY_NAME = 'library_name';

export interface FriendLibrary {
  code: string;
  name: string | null; // the library's published name
  nickname: string | null; // a user-set label ("Dave's shelf")
}

// What to show for a linked library: the nickname if set, else its published
// name, else the share code.
export function libraryLabel(f: { nickname?: string | null; name?: string | null; code: string }): string {
  return f.nickname?.trim() || f.name?.trim() || f.code;
}

// Details of the library this device has published (if any).
export async function getMyLibrary(): Promise<{ code: string; name: string } | null> {
  const code = await getMeta(MY_CODE);
  if (!code) return null;
  return { code, name: (await getMeta(MY_NAME)) ?? 'My library' };
}

export async function saveMyLibrary(code: string, name: string): Promise<void> {
  await setMeta(MY_CODE, code);
  await setMeta(MY_NAME, name);
}

export async function clearMyLibrary(): Promise<void> {
  await setMeta(MY_CODE, '');
  await setMeta(MY_NAME, '');
}

// Saved friends' libraries (codes the user has viewed).
export async function getFriendLibraries(): Promise<FriendLibrary[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<{ code: string; name: string | null; nickname: string | null }>(
    'SELECT code, name, nickname FROM friend_libraries ORDER BY added_at DESC'
  );
  return rows.map((r) => ({ code: r.code, name: r.name, nickname: r.nickname }));
}

export async function setFriendLibraryNickname(code: string, nickname: string): Promise<void> {
  const db = await getDb();
  const value = nickname.trim() || null;
  await db.runAsync('UPDATE friend_libraries SET nickname = ? WHERE code = ?', [value, code]);
}

export async function saveFriendLibrary(code: string, name: string | null): Promise<void> {
  const db = await getDb();
  await db.runAsync(
    'INSERT INTO friend_libraries (code, name) VALUES (?, ?) ON CONFLICT(code) DO UPDATE SET name = excluded.name',
    [code, name]
  );
}

export async function removeFriendLibrary(code: string): Promise<void> {
  const db = await getDb();
  await db.runAsync('DELETE FROM friend_libraries WHERE code = ?', [code]);
}
