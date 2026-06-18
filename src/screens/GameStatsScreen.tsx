import React, { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { RootStackProps } from '../navigation';
import { getGamePlayStats, GamePlayStats } from '../db/plays';
import { colors, radius, spacing } from '../theme';

export default function GameStatsScreen({ route, navigation }: RootStackProps<'GameStats'>) {
  const { gameId } = route.params;
  const [stats, setStats] = useState<GamePlayStats | null>(null);

  useEffect(() => {
    getGamePlayStats(gameId).then((s) => {
      setStats(s);
      navigation.setOptions({ title: s.name });
    });
  }, [gameId]);

  if (!stats) return <View style={styles.safe} />;

  return (
    <ScrollView style={styles.safe} contentContainerStyle={styles.content}>
      <Text style={styles.heading}>{stats.name}</Text>
      <Text style={styles.sub}>
        {stats.totalPlays} play{stats.totalPlays === 1 ? '' : 's'} logged
      </Text>

      <Text style={styles.sectionTitle}>🏆 Winners & records</Text>
      {stats.players.length === 0 ? (
        <Text style={styles.muted}>No plays logged for this game yet.</Text>
      ) : (
        stats.players.map((p, i) => {
          const rate = p.plays > 0 ? Math.round((p.wins / p.plays) * 100) : 0;
          return (
            <View key={p.name} style={styles.row}>
              <Text style={styles.rank}>{i + 1}</Text>
              <Text style={styles.name}>{p.name}</Text>
              <Text style={styles.record}>
                {p.wins}/{p.plays} · {rate}%
              </Text>
            </View>
          );
        })
      )}
      {stats.players.length > 0 && (
        <Text style={styles.legend}>wins / plays · win rate</Text>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  content: { padding: spacing.lg, paddingBottom: spacing.xl * 2 },
  heading: { color: colors.text, fontSize: 24, fontWeight: '700' },
  sub: { color: colors.textMuted, fontSize: 14, marginTop: 2 },
  sectionTitle: { color: colors.text, fontSize: 17, fontWeight: '700', marginTop: spacing.xl, marginBottom: spacing.sm },
  muted: { color: colors.textMuted, fontSize: 14 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  rank: { color: colors.textMuted, fontSize: 14, width: 24, fontWeight: '700' },
  name: { color: colors.text, fontSize: 15, flex: 1 },
  record: { color: colors.textMuted, fontSize: 14 },
  legend: { color: colors.textMuted, fontSize: 12, marginTop: spacing.sm, fontStyle: 'italic' },
});
