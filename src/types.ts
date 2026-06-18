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
  developer: string | null;
  loanedTo: string | null;
  loanedAt: string | null; // ISO date (YYYY-MM-DD)
  createdAt: string;
  updatedAt: string;
  // Derived/joined fields (not stored directly on the games row):
  tags: string[];
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
  developer: string | null;
  tags: string[];
  expansions: ExpansionInput[];
}

export interface Play {
  id: number;
  gameId: number;
  playedAt: string;
  notes: string | null;
  players: PlayPlayer[];
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
}
