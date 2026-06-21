// Shared data shapes used across the DB layer and UI.

export interface Game {
  id: number;
  name: string;
  imageUri: string | null;
  location: string | null;
  year: number | null;
  minPlayers: number | null;
  maxPlayers: number | null;
  playTimeMin: number | null;
  rating: number | null; // personal rating, 0-5 (half steps allowed)
  notes: string | null;
  houseRules: string | null;
  isFavorite: boolean;
  bggId: number | null;
  bggRating: number | null;
  bggWeight: number | null; // BGG complexity / "weight", 0-5
  developer: string | null;
  minAge: number | null; // minimum recommended player age
  complexity: Complexity | null;
  edition: string | null;
  loanedTo: string | null;
  loanedAt: string | null; // ISO date (YYYY-MM-DD)
  createdAt: string;
  updatedAt: string;
  // Derived/joined fields (not stored directly on the games row):
  tags: string[];
  categories: string[];
  playCount: number;
  expansionCount: number;
}

export interface Expansion {
  id: number;
  name: string;
  additionalPlayers: number; // extra players this expansion allows
}

export interface ExpansionInput {
  name: string;
  additionalPlayers: number;
}

// Fields the user can edit. id is absent when creating a new game.
export interface GameInput {
  id?: number;
  name: string;
  imageUri: string | null;
  location: string | null;
  year: number | null;
  minPlayers: number | null;
  maxPlayers: number | null;
  playTimeMin: number | null;
  rating: number | null;
  notes: string | null;
  houseRules: string | null;
  isFavorite: boolean;
  bggId: number | null;
  bggRating: number | null;
  bggWeight: number | null;
  developer: string | null;
  minAge: number | null;
  complexity: Complexity | null;
  edition: string | null;
  tags: string[];
  categories: string[];
  expansions: ExpansionInput[];
}

export type Complexity = 'easy' | 'medium' | 'high';

// A game as it appears in a shared online library (no photos / personal info).
export interface LibraryGame {
  name: string;
  rating: number | null;
  minPlayers: number | null;
  maxPlayers: number | null;
  playTimeMin: number | null;
}

export interface SharedLibrary {
  code: string;
  name: string;
  games: LibraryGame[];
  updatedAt: number | null; // epoch ms
}

// A game merged across all linked libraries (+ optionally your own), for the
// "browse all games" bookcase. Duplicates by name are combined; owners lists
// who has it and their rating.
export interface AggregatedGame {
  name: string;
  minPlayers: number | null;
  maxPlayers: number | null;
  playTimeMin: number | null;
  owners: { owner: string; rating: number | null }[];
  bestRating: number | null;
}

export interface Play {
  id: number;
  gameId: number | null; // null when the game isn't in the collection
  gameName: string | null;
  groupId: number | null;
  playedAt: string;
  notes: string | null;
  players: PlayPlayer[];
  expansions: string[]; // names of expansions used (for display)
  expansionIds: number[]; // expansion ids used (for editing)
}

export interface Group {
  id: number;
  name: string;
}

export interface PlayPlayer {
  name: string;
  isWinner: boolean;
}

export interface LoanRecord {
  id: number;
  loanedTo: string;
  loanedAt: string; // ISO date
  returnedAt: string | null; // ISO date, or null while still out
  photoUri: string | null; // proof photo while on loan (deleted on return)
}

export interface SearchFilters {
  text: string;
  tags: string[];
  favoritesOnly: boolean;
  unplayedOnly: boolean;
  maxPlayTime: number | null; // minutes; e.g. 30 for "quick games"
  minPlayTime: number | null; // minutes; e.g. 60 for "60+ min" (longer games)
  // Game must support this many players. A value of 7 means "7 or more".
  playerCount: number | null;
  minRating: number | null; // personal rating (0-10) at least this
  minBggRating: number | null; // BGG rating (0-10) at least this
  // Minimum-age bands: game's min age within ANY selected [lo, hi] range
  // (hi null = open-ended). Empty = no age filter.
  ageBands: { lo: number; hi: number | null }[];
  complexity: Complexity | null;
  category: string | null; // game must have this category
}
