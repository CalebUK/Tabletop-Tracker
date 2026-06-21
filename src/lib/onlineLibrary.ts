import { doc, setDoc, getDoc, deleteDoc, updateDoc, increment, serverTimestamp } from 'firebase/firestore';
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
  const ref = doc(db, 'libraries', code);
  // Preserve the view counter across updates (setDoc overwrites the document).
  let views = 0;
  if (existingCode) {
    const existing = await getDoc(ref);
    if (existing.exists()) views = (existing.data() as any).views ?? 0;
  }
  await setDoc(ref, {
    ownerUid: uid,
    name: name.trim() || 'My library',
    games,
    gameCount: games.length,
    views,
    updatedAt: serverTimestamp(),
  });
  return code;
}

// How many times this library has been opened by others.
export async function getLibraryViews(code: string): Promise<number> {
  const snap = await getDoc(doc(getFirestoreDb(), 'libraries', code));
  return snap.exists() ? ((snap.data() as any).views ?? 0) : 0;
}

export async function deleteLibrary(code: string): Promise<void> {
  await ensureSignedIn();
  await deleteDoc(doc(getFirestoreDb(), 'libraries', code));
}

// Fetch a library by its share code (anyone with the code can read).
export async function fetchLibrary(code: string): Promise<SharedLibrary | null> {
  const ref = doc(getFirestoreDb(), 'libraries', code.trim().toUpperCase());
  const snap = await getDoc(ref);
  if (!snap.exists()) return null;
  // Count this view (best-effort; ignored if offline or rules disallow it).
  updateDoc(ref, { views: increment(1) }).catch(() => {});
  const data = snap.data() as any;
  const games: LibraryGame[] = Array.isArray(data.games) ? data.games : [];
  return {
    code: snap.id,
    name: data.name ?? 'Library',
    games,
    updatedAt: data.updatedAt?.toMillis ? data.updatedAt.toMillis() : null,
  };
}
