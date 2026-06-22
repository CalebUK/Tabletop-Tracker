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
  PlayerStats: { name: string };
  GameStats: { gameId: number };
  GroupStats: { groupId: number };
  Backup: undefined;
  About: undefined;
  FriendLibrary: { code: string; name?: string };
  BrowseAll: undefined;
};

export type RootStackProps<T extends keyof RootStackParamList> =
  NativeStackScreenProps<RootStackParamList, T>;
