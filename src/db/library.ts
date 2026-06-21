import { getDb } from './database';
import { getMeta, setMeta } from './meta';

const MY_CODE = 'library_code';
const MY_NAME = 'library_name';

export interface FriendLibrary {
  code: string;
  name: string | null;
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
  const rows = await db.getAllAsync<{ code: string; name: string | null }>(
    'SELECT code, name FROM friend_libraries ORDER BY added_at DESC'
  );
  return rows.map((r) => ({ code: r.code, name: r.name }));
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
