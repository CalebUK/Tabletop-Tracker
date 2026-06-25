// Thin client for the BoardGameGeek XML API2 (https://boardgamegeek.com/wiki/page/BGG_XML_API2).
// It's free and needs no key. React Native has no XML DOM parser, so we pull
// the handful of fields we need with small regexes — good enough for this app.

const BASE = 'https://boardgamegeek.com/xmlapi2';

export interface BggSearchResult {
  id: number;
  name: string;
  year: number | null;
}

export interface BggDetails {
  id: number;
  name: string;
  year: number | null;
  minPlayers: number | null;
  maxPlayers: number | null;
  playTimeMin: number | null;
  minAge: number | null;
  developer: string | null; // BGG's "designer" — maps to our Developer field
  bggRating: number | null;
  bggWeight: number | null; // BGG complexity / "weight", 0-5
  imageUrl: string | null;
  description: string | null; // BGG's short tagline (one fun sentence)
}

function attr(xml: string, tag: string, name = 'value'): string | null {
  const m = new RegExp(`<${tag}[^>]*\\b${name}="([^"]*)"`, 'i').exec(xml);
  return m ? decodeEntities(m[1]) : null;
}

function numAttr(xml: string, tag: string): number | null {
  const v = attr(xml, tag);
  if (v == null || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function decodeEntities(s: string): string {
  return s
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>');
}

// BGG now requires a registered application token (Authorization: Bearer ...).
// Set EXPO_PUBLIC_BGG_TOKEN in the build env (kept out of git). Without it,
// requests get 401 and we fall back to manual entry.
const BGG_TOKEN = process.env.EXPO_PUBLIC_BGG_TOKEN;

const HEADERS: Record<string, string> = {
  'User-Agent': 'TabletopTracker/1.0 (board game collection app)',
  Accept: 'application/xml, text/xml',
  ...(BGG_TOKEN ? { Authorization: `Bearer ${BGG_TOKEN}` } : {}),
};

// Friendlier message for BoardGameGeek's access limits / token issues.
function bggError(status: number): Error {
  if (status === 401 || status === 403) {
    return new Error(
      BGG_TOKEN
        ? 'BoardGameGeek rejected the request (token may be pending or invalid). You can enter the BGG rating manually below.'
        : 'Automatic BoardGameGeek lookup needs a BGG app token, which isn’t set up yet. You can enter the BGG rating manually below.'
    );
  }
  if (status === 429) {
    return new Error('BoardGameGeek is rate-limiting right now. Try again shortly, or enter the rating manually.');
  }
  return new Error(`BoardGameGeek error (${status}).`);
}

export async function bggSearch(query: string): Promise<BggSearchResult[]> {
  const q = query.trim();
  if (!q) return [];
  const res = await fetch(`${BASE}/search?type=boardgame&query=${encodeURIComponent(q)}`, {
    headers: HEADERS,
  });
  if (!res.ok) throw bggError(res.status);
  const xml = await res.text();

  const results: BggSearchResult[] = [];
  const seen = new Set<number>();
  const itemRe = /<item[^>]*\bid="(\d+)"[^>]*>([\s\S]*?)<\/item>/g;
  let m: RegExpExecArray | null;
  while ((m = itemRe.exec(xml)) !== null) {
    const id = Number(m[1]);
    if (seen.has(id)) continue;
    seen.add(id);
    const body = m[2];
    const name = attr(body, 'name') ?? '(unknown)';
    const year = numAttr(body, 'yearpublished');
    results.push({ id, name, year });
    if (results.length >= 250) break; // collect broadly, then rank below
  }

  // Rank so the game you most likely mean floats to the top: exact name match
  // first, then "starts with", then "contains"; within a tier the shorter name
  // (usually the base game, not an edition/spin-off) and earlier year win.
  const ql = q.toLowerCase();
  const tier = (name: string) => {
    const n = name.toLowerCase();
    if (n === ql) return 0;
    if (n.startsWith(ql)) return 1;
    if (n.includes(ql)) return 2;
    return 3;
  };
  results.sort(
    (a, b) =>
      tier(a.name) - tier(b.name) ||
      a.name.length - b.name.length ||
      (a.year ?? 9999) - (b.year ?? 9999)
  );
  return results.slice(0, 40);
}

// The one-line tagline shown under a game's title on the website lives in BGG's
// JSON API (item.short_description), NOT the XML thing endpoint. This endpoint
// needs no token, so we fetch it separately and tolerate any failure.
async function fetchTagline(id: number): Promise<string | null> {
  try {
    const res = await fetch(
      `https://api.geekdo.com/api/geekitems?objectid=${id}&objecttype=thing`,
      { headers: { 'User-Agent': HEADERS['User-Agent'], Accept: 'application/json' } }
    );
    if (!res.ok) return null;
    const data: any = await res.json();
    const t = data?.item?.short_description;
    return typeof t === 'string' && t.trim() ? t.trim() : null;
  } catch {
    return null;
  }
}

export async function bggDetails(id: number): Promise<BggDetails | null> {
  // Kick off the tagline lookup in parallel (different endpoint, no token).
  const taglineP = fetchTagline(id);
  // BGG sometimes answers 202 ("queued") first; retry briefly.
  let res = await fetch(`${BASE}/thing?id=${id}&stats=1`, { headers: HEADERS });
  for (let i = 0; i < 2 && res.status === 202; i++) {
    await new Promise((r) => setTimeout(r, 1500));
    res = await fetch(`${BASE}/thing?id=${id}&stats=1`, { headers: HEADERS });
  }
  if (!res.ok) throw bggError(res.status);
  const xml = await res.text();

  // Primary name carries type="primary"; fall back to the first name tag.
  const primary =
    /<name[^>]*type="primary"[^>]*value="([^"]*)"/i.exec(xml)?.[1] ?? attr(xml, 'name');
  const designer = /<link[^>]*type="boardgamedesigner"[^>]*value="([^"]*)"/i.exec(xml)?.[1] ?? null;
  const avg = /<average[^>]*value="([^"]*)"/i.exec(xml)?.[1];
  const rating = avg != null && avg !== '' && Number(avg) > 0 ? Number(avg) : null;
  const weightStr = /<averageweight[^>]*value="([^"]*)"/i.exec(xml)?.[1];
  const weight = weightStr != null && weightStr !== '' && Number(weightStr) > 0 ? Number(weightStr) : null;

  return {
    id,
    name: primary ? decodeEntities(primary) : '(unknown)',
    year: numAttr(xml, 'yearpublished'),
    minPlayers: numAttr(xml, 'minplayers'),
    maxPlayers: numAttr(xml, 'maxplayers'),
    playTimeMin: numAttr(xml, 'playingtime'),
    minAge: numAttr(xml, 'minage'),
    developer: designer ? decodeEntities(designer) : null,
    bggRating: rating,
    bggWeight: weight,
    imageUrl: /<image>([^<]*)<\/image>/i.exec(xml)?.[1] ?? null,
    description: await taglineP,
  };
}
