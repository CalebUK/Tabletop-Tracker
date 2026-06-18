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
  imageUrl: string | null;
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

const HEADERS = {
  'User-Agent': 'TabletopTracker/1.0 (board game collection app)',
  Accept: 'application/xml, text/xml',
};

// Friendlier message for BoardGameGeek's access limits.
function bggError(status: number): Error {
  if (status === 401 || status === 403 || status === 429) {
    return new Error(
      'BoardGameGeek is limiting automatic lookups right now. You can enter the BGG rating manually below.'
    );
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
    if (results.length >= 30) break;
  }
  return results;
}

export async function bggDetails(id: number): Promise<BggDetails | null> {
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
    imageUrl: /<image>([^<]*)<\/image>/i.exec(xml)?.[1] ?? null,
  };
}
