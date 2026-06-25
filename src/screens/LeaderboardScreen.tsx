import React, { useEffect, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { RootStackProps } from '../navigation';
import { getGameRankings, getPlayerRankings } from '../db/plays';
import { getGroupGameRankings, getGroupPlayerRankings } from '../db/groups';
import { colors, radius, spacing } from '../theme';

type PlayerRow = { name: string; wins: number; plays: number };
type GameRow = { name: string; plays: number; gameId: number | null };

export default function LeaderboardScreen({ route, navigation }: RootStackProps<'Leaderboard'>) {
  const { kind, groupId, groupName } = route.params;
  const isPlayers = kind === 'players';
  const [players, setPlayers] = useState<PlayerRow[]>([]);
  const [games, setGames] = useState<GameRow[]>([]);

  useEffect(() => {
    const prefix = groupName ? `${groupName} · ` : '';
    navigation.setOptions({ title: `${prefix}${isPlayers ? 'All players' : 'All games'}` });
    if (isPlayers) {
      (groupId != null ? getGroupPlayerRankings(groupId) : getPlayerRankings())
        .then(setPlayers)
        .catch((e) => console.warn('leaderboard', e));
    } else {
      (groupId != null
        ? getGroupGameRankings(groupId)
        : getGameRankings().then((rs) => rs.map((r) => ({ name: r.name, plays: r.plays, gameId: r.id })))
      )
        .then(setGames)
        .catch((e) => console.warn('leaderboard', e));
    }
  }, [kind, groupId]);

  if (isPlayers) {
    return (
      <SafeAreaView style={styles.safe} edges={['bottom']}>
        <FlatList
          data={players}
          keyExtractor={(r, i) => r.name + i}
          contentContainerStyle={styles.list}
          renderItem={({ item, index }) => (
            <Pressable
              style={styles.row}
              onPress={() => navigation.navigate('PlayerStats', { name: item.name, groupId, groupName })}
            >
              <Text style={styles.rank}>{index + 1}</Text>
              <Text style={styles.name} numberOfLines={1}>{item.name} ›</Text>
              <Text style={styles.value}>
                {item.wins} win{item.wins === 1 ? '' : 's'} · {item.plays} play{item.plays === 1 ? '' : 's'}
              </Text>
            </Pressable>
          )}
          ListEmptyComponent={<Text style={styles.empty}>Log some plays to build a leaderboard.</Text>}
        />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      <FlatList
        data={games}
        keyExtractor={(r, i) => r.name + i}
        contentContainerStyle={styles.list}
        renderItem={({ item, index }) => (
          <Pressable
            style={styles.row}
            onPress={() =>
              navigation.navigate('GameStats', {
                gameId: item.gameId ?? undefined,
                gameName: item.gameId == null ? item.name : undefined,
                groupId,
                groupName,
              })
            }
          >
            <Text style={styles.rank}>{index + 1}</Text>
            <Text style={styles.name} numberOfLines={1}>{item.name} ›</Text>
            <Text style={styles.value}>{item.plays} play{item.plays === 1 ? '' : 's'}</Text>
          </Pressable>
        )}
        ListEmptyComponent={<Text style={styles.empty}>Log some plays to build a leaderboard.</Text>}
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
