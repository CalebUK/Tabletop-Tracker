import type { NativeStackScreenProps } from '@react-navigation/native-stack';

// Screens that live above the bottom tabs in the root stack.
export type RootStackParamList = {
  Tabs: undefined;
  GameDetail: { gameId: number };
  EditGame: { gameId?: number }; // omit gameId to add a new game
  LogPlay: { gameId: number; playId?: number }; // playId to edit an existing play
  Loan: { gameId: number };
  PlayerStats: { name: string };
};

export type RootStackProps<T extends keyof RootStackParamList> =
  NativeStackScreenProps<RootStackParamList, T>;
