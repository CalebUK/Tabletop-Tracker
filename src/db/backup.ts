import * as FileSystem from 'expo-file-system/legacy';
import { getDb } from './database';
import { getAllGames, getExpansions } from './games';
import { isoToUk } from '../lib/dates';

// Tables in dependency order (parents first) so a restore satisfies foreign keys.
// (Restore deletes in reverse — children first — before re-inserting.)
const TABLES = [
  'tags',
  'categories',
  'groups',
  'games',
  'expansions',
  'plays',
  'game_tags',
  'game_categories',
  'play_players',
  'play_expansions',
  'loans',
  'meta',
  'friend_libraries',
] as const;

const IMAGE_DIR = `${FileSystem.documentDirectory}game-images/`;
const BACKUP_APP_ID = 'tabletop-tracker';

interface BackupFile {
  app: string;
  version: number;
  exportedAt: string;
  tables: Record<string, any[]>;
  images: Record<string, string>; // basename -> base64
}

function basename(uri: string): string {
  return uri.split('/').pop() ?? uri;
}

// Build a complete backup object: every table plus base64 of each local photo.
async function buildBackup(): Promise<BackupFile> {
  const db = await getDb();
  const tables: Record<string, any[]> = {};
  for (const t of TABLES) {
    tables[t] = await db.getAllAsync(`SELECT * FROM ${t}`);
  }

  const images: Record<string, string> = {};
  for (const g of tables.games) {
    const uri: string | null = g.image_uri;
    if (uri && uri.startsWith('file') && uri.includes('game-images')) {
      const name = basename(uri);
      try {
        images[name] = await FileSystem.readAsStringAsync(uri, {
          encoding: FileSystem.EncodingType.Base64,
        });
      } catch {
        // Image file missing — skip it; the row keeps its (now broken) uri.
      }
    }
  }

  return {
    app: BACKUP_APP_ID,
    version: 2, // v2 adds categories, groups, meta and friend libraries
    exportedAt: new Date().toISOString(),
    tables,
    images,
  };
}

// Write a full backup to a cache file and return its uri (for sharing).
export async function exportBackup(): Promise<string> {
  const backup = await buildBackup();
  const stamp = new Date().toISOString().slice(0, 10);
  const uri = `${FileSystem.cacheDirectory}tabletop-tracker-backup-${stamp}.json`;
  await FileSystem.writeAsStringAsync(uri, JSON.stringify(backup));
  return uri;
}

async function ensureImageDir(): Promise<void> {
  const info = await FileSystem.getInfoAsync(IMAGE_DIR);
  if (!info.exists) await FileSystem.makeDirectoryAsync(IMAGE_DIR, { intermediates: true });
}

// Replace ALL current data with the contents of a backup file.
export async function importBackup(fileUri: string): Promise<void> {
  const raw = await FileSystem.readAsStringAsync(fileUri);
  const backup = JSON.parse(raw) as BackupFile;
  if (backup.app !== BACKUP_APP_ID || !backup.tables) {
    throw new Error('That file is not a Tabletop Tracker backup.');
  }

  // Restore photos to this device first, mapping basename -> new local uri.
  await ensureImageDir();
  const newUriByName: Record<string, string> = {};
  for (const [name, b64] of Object.entries(backup.images ?? {})) {
    const dest = `${IMAGE_DIR}${name}`;
    try {
      await FileSystem.writeAsStringAsync(dest, b64, {
        encoding: FileSystem.EncodingType.Base64,
      });
      newUriByName[name] = dest;
    } catch {
      // ignore a single bad image
    }
  }

  const db = await getDb();
  await db.withTransactionAsync(async () => {
    // Wipe existing data (child tables first).
    for (const t of [...TABLES].reverse()) {
      await db.runAsync(`DELETE FROM ${t}`);
    }
    // Re-insert, fixing up game photo paths for this device.
    for (const t of TABLES) {
      for (const row of backup.tables[t] ?? []) {
        const r = { ...row };
        if (t === 'games' && r.image_uri) {
          const mapped = newUriByName[basename(r.image_uri)];
          if (mapped) r.image_uri = mapped;
        }
        const keys = Object.keys(r);
        const sql = `INSERT INTO ${t} (${keys.join(', ')}) VALUES (${keys.map(() => '?').join(', ')})`;
        await db.runAsync(sql, keys.map((k) => r[k]));
      }
    }
  });
}

// ---- CSV export (human-readable collection list) ----

function csvCell(value: unknown): string {
  const s = value == null ? '' : String(value);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export async function exportCsv(): Promise<string> {
  const games = await getAllGames();
  const headers = [
    'Name', 'Year', 'Edition', 'Location', 'Min Players', 'Max Players',
    'Max with Expansions', 'Play Time (min)', 'Min Age', 'Teachability (1-5)', 'BGG Complexity',
    'Play Style', 'My Rating', 'BGG Rating', 'Publisher/Designer', 'Favourite',
    'Categories', 'Tags', 'Expansions', 'Plays', 'Last Played', 'Notes', 'House Rules',
  ];
  const lines = [headers.join(',')];

  for (const g of games) {
    const exps = await getExpansions(g.id);
    const playStyle = [g.isDuel && 'Duel', g.isParty && 'Party', g.isCoop && 'Co-Op']
      .filter(Boolean)
      .join('; ');
    const maxWithExp =
      g.maxPlayers != null ? g.maxPlayers + g.expansionPlayers : '';
    const expansions = exps
      .map((e) => (e.additionalPlayers ? `${e.name} (+${e.additionalPlayers})` : e.name))
      .join('; ');
    const row = [
      g.name, g.year, g.edition, g.location, g.minPlayers, g.maxPlayers,
      maxWithExp, g.playTimeMin, g.minAge, g.teachRating, g.bggWeight,
      playStyle, g.rating, g.bggRating, g.developer, g.isFavorite ? 'Yes' : 'No',
      g.categories.join('; '), g.tags.join('; '), expansions, g.playCount,
      g.lastPlayedAt ? isoToUk(g.lastPlayedAt) : '', g.notes, g.houseRules,
    ];
    lines.push(row.map(csvCell).join(','));
  }

  const uri = `${FileSystem.cacheDirectory}tabletop-tracker-collection.csv`;
  await FileSystem.writeAsStringAsync(uri, lines.join('\n'));
  return uri;
}
