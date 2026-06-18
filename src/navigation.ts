import type { NativeStackScreenProps } from '@react-navigation/native-stack';

// Screens that live above the bottom tabs in the root stack.
export type RootStackParamList = {
  Tabs: undefined;
  GameDetail: { gameId: number };
  // omit gameId to add a new game; bggId pre-fills from a BoardGameGeek match
  EditGame: { gameId?: number; bggId?: number };
  LogPlay: { gameId: number; playId?: number }; // playId to edit an existing play
  Loan: { gameId: number };
  ScanBarcode: { gameId?: number }; // gameId to return to when editing
  PlayerStats: { name: string };
};

export type RootStackProps<T extends keyof RootStackParamList> =
  NativeStackScreenProps<RootStackParamList, T>;
