import { doc, setDoc, getDoc, deleteDoc, serverTimestamp } from 'firebase/firestore';
import { getFirestoreDb, ensureSignedIn } from './firebase';
import { getGamesForLibrary } from '../db/games';
import { LibraryGame, SharedLibrary } from '../types';

// Unambiguous code alphabet (no 0/O/1/I) — 6 chars, easy to read and type.
const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

function randomCode(): string {
  let s = '';
  for (let i = 0; i < 6; i++) s += ALPHABET[Math.floor(Math.random() * ALPHABET.length)];
  return s;
}

async function freshCode(): Promise<string> {
  const db = getFirestoreDb();
  // Avoid the rare collision with an existing library.
  for (let i = 0; i < 5; i++) {
    const code = randomCode();
    const snap = await getDoc(doc(db, 'libraries', code));
    if (!snap.exists()) return code;
  }
  return randomCode();
}

// Publish (create or update) this device's library. Returns the share code.
export async function publishLibrary(name: string, existingCode?: string | null): Promise<string> {
  const uid = await ensureSignedIn();
  const db = getFirestoreDb();
  const games = await getGamesForLibrary();
  const code = existingCode || (await freshCode());
  await setDoc(doc(db, 'libraries', code), {
    ownerUid: uid,
    name: name.trim() || 'My library',
    games,
    gameCount: games.length,
    updatedAt: serverTimestamp(),
  });
  return code;
}

export async function deleteLibrary(code: string): Promise<void> {
  await ensureSignedIn();
  await deleteDoc(doc(getFirestoreDb(), 'libraries', code));
}

// Fetch a library by its share code (anyone with the code can read).
export async function fetchLibrary(code: string): Promise<SharedLibrary | null> {
  const snap = await getDoc(doc(getFirestoreDb(), 'libraries', code.trim().toUpperCase()));
  if (!snap.exists()) return null;
  const data = snap.data() as any;
  const games: LibraryGame[] = Array.isArray(data.games) ? data.games : [];
  return {
    code: snap.id,
    name: data.name ?? 'Library',
    games,
    updatedAt: data.updatedAt?.toMillis ? data.updatedAt.toMillis() : null,
  };
}
