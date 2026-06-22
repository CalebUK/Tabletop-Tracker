import { doc, setDoc, getDoc, deleteDoc, updateDoc, increment, serverTimestamp } from 'firebase/firestore';
import { getFirestoreDb, ensureSignedIn } from './firebase';
import { getAllGames, getGamesForLibrary } from '../db/games';
import { getFriendLibraries } from '../db/library';
import { AggregatedGame, LibraryGame, SharedLibrary, TasteSuggestion } from '../types';

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
// countView bumps the owner's view counter (skip it for bulk/aggregate reads).
export async function fetchLibrary(code: string, countView = true): Promise<SharedLibrary | null> {
  const ref = doc(getFirestoreDb(), 'libraries', code.trim().toUpperCase());
  const snap = await getDoc(ref);
  if (!snap.exists()) return null;
  // Count this view (best-effort; ignored if offline or rules disallow it).
  if (countView) updateDoc(ref, { views: increment(1) }).catch(() => {});
  const data = snap.data() as any;
  const games: LibraryGame[] = Array.isArray(data.games) ? data.games : [];
  return {
    code: snap.id,
    name: data.name ?? 'Library',
    games,
    updatedAt: data.updatedAt?.toMillis ? data.updatedAt.toMillis() : null,
  };
}

// Map of game name (lowercased) -> distinct friend names who own it, across all
// linked friend libraries. Used to flag wishlist games a friend already has.
// Returns an empty map when no libraries are linked or the fetch fails.
export async function getFriendOwnersByGame(): Promise<Map<string, string[]>> {
  const map = new Map<string, string[]>();
  const all = await fetchAllGames(false);
  for (const g of all) {
    const owners = Array.from(new Set(g.owners.map((o) => o.owner)));
    if (owners.length) map.set(g.name.trim().toLowerCase(), owners);
  }
  return map;
}

// "Similar tastes" needs at least this many games you've both rated, and this
// share of them must agree (ratings within CLOSE_DELTA of each other). Kept
// strict for now since we don't yet know how reliable the match feels.
const MIN_SHARED = 5;
const CLOSE_DELTA = 1;
const AGREE_RATIO = 0.8;

// Suggest games to wishlist: one per linked friend whose ratings line up with
// yours on the games you both own — that friend's top-rated game you don't
// already own or have wishlisted. De-duplicated across friends, best first.
export async function getTasteSuggestions(): Promise<TasteSuggestion[]> {
  const mine = await getGamesForLibrary(); // owned games, with my ratings
  const myRatingByName = new Map<string, number>();
  const myOwnedNames = new Set<string>();
  for (const g of mine) {
    const key = g.name.trim().toLowerCase();
    myOwnedNames.add(key);
    if (g.rating != null) myRatingByName.set(key, g.rating);
  }
  const myWishNames = new Set(
    (await getAllGames(true)).map((w) => w.name.trim().toLowerCase())
  );

  const friends = await getFriendLibraries();
  const libs = await Promise.all(
    friends.map((f) => fetchLibrary(f.code, false).catch(() => null))
  );

  // One candidate suggestion per "similar" friend.
  const suggestions: TasteSuggestion[] = [];
  friends.forEach((f, i) => {
    const lib = libs[i];
    if (!lib) return;
    const friend = f.name || lib.name || f.code;

    let shared = 0;
    let close = 0;
    for (const g of lib.games) {
      const myR = myRatingByName.get(g.name.trim().toLowerCase());
      if (myR != null && g.rating != null) {
        shared++;
        if (Math.abs(myR - g.rating) <= CLOSE_DELTA) close++;
      }
    }
    if (shared < MIN_SHARED || close / shared < AGREE_RATIO) return;

    // Their highest-rated game that you neither own nor have wishlisted.
    const top = lib.games
      .filter((g) => g.rating != null)
      .filter((g) => {
        const key = g.name.trim().toLowerCase();
        return !myOwnedNames.has(key) && !myWishNames.has(key);
      })
      .sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0))[0];
    if (top) suggestions.push({ friend, sharedCount: shared, closeCount: close, game: top });
  });

  // One per matching friend, but if two friends top-suggest the same game show
  // it once (keep the higher rating). Best games first.
  const byGame = new Map<string, TasteSuggestion>();
  for (const s of suggestions) {
    const key = s.game.name.trim().toLowerCase();
    const existing = byGame.get(key);
    if (!existing || (s.game.rating ?? 0) > (existing.game.rating ?? 0)) byGame.set(key, s);
  }
  return [...byGame.values()].sort((a, b) => (b.game.rating ?? 0) - (a.game.rating ?? 0));
}

// Merge every game across linked libraries (+ optionally your own) into one
// de-duplicated list for the "browse all games" view.
export async function fetchAllGames(includeOwn: boolean): Promise<AggregatedGame[]> {
  const sources: { owner: string; games: LibraryGame[] }[] = [];

  if (includeOwn) {
    sources.push({ owner: 'You', games: await getGamesForLibrary() });
  }
  const friends = await getFriendLibraries();
  const fetched = await Promise.all(friends.map((f) => fetchLibrary(f.code, false).catch(() => null)));
  friends.forEach((f, i) => {
    const lib = fetched[i];
    if (lib) sources.push({ owner: f.name || lib.name || f.code, games: lib.games });
  });

  const map = new Map<string, AggregatedGame>();
  for (const src of sources) {
    for (const g of src.games) {
      const key = g.name.trim().toLowerCase();
      if (!key) continue;
      let agg = map.get(key);
      if (!agg) {
        agg = {
          name: g.name.trim(),
          minPlayers: g.minPlayers,
          maxPlayers: g.maxPlayers,
          playTimeMin: g.playTimeMin,
          owners: [],
          bestRating: null,
        };
        map.set(key, agg);
      }
      agg.owners.push({ owner: src.owner, rating: g.rating });
      if (g.rating != null) agg.bestRating = Math.max(agg.bestRating ?? 0, g.rating);
      if (agg.minPlayers == null) agg.minPlayers = g.minPlayers;
      if (agg.maxPlayers == null) agg.maxPlayers = g.maxPlayers;
      if (agg.playTimeMin == null) agg.playTimeMin = g.playTimeMin;
    }
  }
  return [...map.values()];
}
