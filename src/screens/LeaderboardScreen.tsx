import React, { useEffect, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { RootStackProps } from '../navigation';
import {
  GameRanking,
  PlayerRanking,
  getGameRankings,
  getPlayerRankings,
} from '../db/plays';
import { colors, radius, spacing } from '../theme';

type Row = (PlayerRanking | GameRanking) & { id?: number };

export default function LeaderboardScreen({ route, navigation }: RootStackProps<'Leaderboard'>) {
  const { kind } = route.params;
  const isPlayers = kind === 'players';
  const [rows, setRows] = useState<Row[]>([]);

  useEffect(() => {
    navigation.setOptions({ title: isPlayers ? 'All players' : 'All games' });
    const load = isPlayers ? getPlayerRankings() : getGameRankings();
    load.then((r) => setRows(r as Row[])).catch((e) => console.warn('leaderboard', e));
  }, [kind]);

  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      <FlatList
        data={rows}
        keyExtractor={(r, i) => (isPlayers ? (r as PlayerRanking).name : String((r as GameRanking).id)) + i}
        contentContainerStyle={styles.list}
        renderItem={({ item, index }) => {
          if (isPlayers) {
            const p = item as PlayerRanking;
            return (
              <Pressable
                style={styles.row}
                onPress={() => navigation.navigate('PlayerStats', { name: p.name })}
              >
                <Text style={styles.rank}>{index + 1}</Text>
                <Text style={styles.name} numberOfLines={1}>{p.name} ›</Text>
                <Text style={styles.value}>
                  {p.wins} win{p.wins === 1 ? '' : 's'} · {p.plays} play{p.plays === 1 ? '' : 's'}
                </Text>
              </Pressable>
            );
          }
          const g = item as GameRanking;
          return (
            <Pressable
              style={styles.row}
              onPress={() => navigation.navigate('GameStats', { gameId: g.id })}
            >
              <Text style={styles.rank}>{index + 1}</Text>
              <Text style={styles.name} numberOfLines={1}>{g.name} ›</Text>
              <Text style={styles.value}>{g.plays} play{g.plays === 1 ? '' : 's'}</Text>
            </Pressable>
          );
        }}
        ListEmptyComponent={
          <Text style={styles.empty}>Log some plays to build a leaderboard.</Text>
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  list: { padding: spacing.lg, paddingBottom: spacing.xl * 2 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    marginBottom: spacing.sm,
    gap: spacing.sm,
  },
  rank: { color: colors.textMuted, fontSize: 14, width: 28, fontWeight: '700' },
  name: { color: colors.text, fontSize: 15, flex: 1 },
  value: { color: colors.textMuted, fontSize: 13 },
  empty: { color: colors.textMuted, textAlign: 'center', marginTop: spacing.xl },
});
