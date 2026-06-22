import type { NativeStackScreenProps } from '@react-navigation/native-stack';

// Screens that live above the bottom tabs in the root stack.
export type RootStackParamList = {
  Tabs: undefined;
  GameDetail: { gameId: number };
  // omit gameId to add a new game; wishlist:true creates it on the wishlist
  EditGame: { gameId?: number; wishlist?: boolean };
  // Log/edit a play. From a game: pass gameId. From a group: pass groupId and
  // let the user enter any game. playId edits an existing play.
  LogPlay: { gameId?: number; groupId?: number; playId?: number };
  Loan: { gameId: number };
  // groupId/groupName scope the stats to a single gaming group (omit for global).
  PlayerStats: { name: string; groupId?: number; groupName?: string };
  GameStats: { gameId: number; groupId?: number; groupName?: string };
  GroupStats: { groupId: number };
  Leaderboard: { kind: 'players' | 'games' }; // full ranked list (see all)
  Backup: undefined;
  About: undefined;
  FriendLibrary: { code: string; name?: string };
  BrowseAll: undefined;
};

export type RootStackProps<T extends keyof RootStackParamList> =
  NativeStackScreenProps<RootStackParamList, T>;
