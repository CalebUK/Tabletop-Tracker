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
  let code = existingCode || (await freshCode());
  // Preserve the view counter across updates (setDoc overwrites the document).
  let views = 0;
  if (existingCode) {
    const existing = await getDoc(doc(db, 'libraries', existingCode));
    if (existing.exists()) {
      const data = existing.data() as any;
      if (data.ownerUid && data.ownerUid !== uid) {
        // This install no longer owns the existing library — the anonymous login
        // was reset (e.g. after a reinstall or clearing app data), so Firestore
        // would reject the update. Publish a fresh library we do own instead.
        code = await freshCode();
      } else {
        views = data.views ?? 0;
      }
    }
  }
  const ref = doc(db, 'libraries', code);
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

// A linked friend's library, fetched once. Several features build off these.
interface FriendSource {
  owner: string;
  games: LibraryGame[];
}

// Fetch every linked friend's library once (view counter not bumped). The
// single network round-trip behind the wishlist's owner-flags and suggestions
// and the "browse all" view, so we don't fetch the same libraries repeatedly.
async function fetchFriendSources(): Promise<FriendSource[]> {
  const friends = await getFriendLibraries();
  const fetched = await Promise.all(
    friends.map((f) => fetchLibrary(f.code, false).catch(() => null))
  );
  const sources: FriendSource[] = [];
  friends.forEach((f, i) => {
    const lib = fetched[i];
    if (lib) sources.push({ owner: f.name || lib.name || f.code, games: lib.games });
  });
  return sources;
}

// Map of game name (lowercased) -> distinct friend names who own it.
function ownersByGame(sources: FriendSource[]): Map<string, string[]> {
  const map = new Map<string, string[]>();
  for (const src of sources) {
    for (const g of src.games) {
      const key = g.name.trim().toLowerCase();
      if (!key) continue;
      const arr = map.get(key);
      if (arr) {
        if (!arr.includes(src.owner)) arr.push(src.owner);
      } else {
        map.set(key, [src.owner]);
      }
    }
  }
  return map;
}

// "Similar tastes" needs at least this many games you've both rated, and this
// share of them must agree (ratings within CLOSE_DELTA of each other). Kept
// strict for now since we don't yet know how reliable the match feels.
const MIN_SHARED = 5;
const CLOSE_DELTA = 1;
const AGREE_RATIO = 0.8;

// One suggestion per linked friend whose ratings line up with yours on the
// games you both own — their top-rated game you don't own or have wishlisted.
function suggestionsFromSources(
  sources: FriendSource[],
  myRatingByName: Map<string, number>,
  myOwnedNames: Set<string>,
  myWishNames: Set<string>
): TasteSuggestion[] {
  const suggestions: TasteSuggestion[] = [];
  for (const src of sources) {
    let shared = 0;
    let close = 0;
    for (const g of src.games) {
      const myR = myRatingByName.get(g.name.trim().toLowerCase());
      if (myR != null && g.rating != null) {
        shared++;
        if (Math.abs(myR - g.rating) <= CLOSE_DELTA) close++;
      }
    }
    if (shared < MIN_SHARED || close / shared < AGREE_RATIO) continue;

    const top = src.games
      .filter((g) => g.rating != null)
      .filter((g) => {
        const key = g.name.trim().toLowerCase();
        return !myOwnedNames.has(key) && !myWishNames.has(key);
      })
      .sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0))[0];
    if (top) suggestions.push({ friend: src.owner, sharedCount: shared, closeCount: close, game: top });
  }

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

// Build the index of my owned/wishlisted game names and my ratings.
async function myGameIndex(): Promise<{
  ratingByName: Map<string, number>;
  ownedNames: Set<string>;
  wishNames: Set<string>;
}> {
  const [mine, wish] = await Promise.all([getGamesForLibrary(), getAllGames(true)]);
  const ratingByName = new Map<string, number>();
  const ownedNames = new Set<string>();
  for (const g of mine) {
    const key = g.name.trim().toLowerCase();
    ownedNames.add(key);
    if (g.rating != null) ratingByName.set(key, g.rating);
  }
  const wishNames = new Set(wish.map((w) => w.name.trim().toLowerCase()));
  return { ratingByName, ownedNames, wishNames };
}

// Everything the wishlist needs from friends' libraries, in a SINGLE fetch:
// which friends own each game, and the taste-based suggestions.
export async function getWishlistInsights(): Promise<{
  owners: Map<string, string[]>;
  suggestions: TasteSuggestion[];
}> {
  const [sources, mine] = await Promise.all([fetchFriendSources(), myGameIndex()]);
  return {
    owners: ownersByGame(sources),
    suggestions: suggestionsFromSources(sources, mine.ratingByName, mine.ownedNames, mine.wishNames),
  };
}

// Just the owner flags (used by the game detail screen for a single game).
export async function getFriendOwnersByGame(): Promise<Map<string, string[]>> {
  return ownersByGame(await fetchFriendSources());
}

// Merge every game across linked libraries (+ optionally your own) into one
// de-duplicated list for the "browse all games" view.
export async function fetchAllGames(includeOwn: boolean): Promise<AggregatedGame[]> {
  const sources: FriendSource[] = [];
  if (includeOwn) {
    sources.push({ owner: 'You', games: await getGamesForLibrary() });
  }
  sources.push(...(await fetchFriendSources()));

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
          image: g.image ?? null,
          description: g.description ?? null,
          owners: [],
          bestRating: null,
        };
        map.set(key, agg);
      }
      agg.owners.push({ owner: src.owner, rating: g.rating });
      if (g.rating != null) agg.bestRating = Math.max(agg.bestRating ?? 0, g.rating);
      if (agg.image == null && g.image) agg.image = g.image;
      if (agg.description == null && g.description) agg.description = g.description;
      if (agg.minPlayers == null) agg.minPlayers = g.minPlayers;
      if (agg.maxPlayers == null) agg.maxPlayers = g.maxPlayers;
      if (agg.playTimeMin == null) agg.playTimeMin = g.playTimeMin;
    }
  }
  return [...map.values()];
}
