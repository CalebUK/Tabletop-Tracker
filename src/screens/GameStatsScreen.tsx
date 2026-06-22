import React, { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { RootStackProps } from '../navigation';
import { getGamePlayStats, GamePlayStats } from '../db/plays';
import { isoToUk } from '../lib/dates';
import { colors, spacing } from '../theme';

const MEDALS = ['🥇', '🥈', '🥉'];

function fmtScore(n: number): string {
  return Number.isInteger(n) ? String(n) : n.toFixed(1);
}

export default function GameStatsScreen({ route, navigation }: RootStackProps<'GameStats'>) {
  const { gameId, gameName, groupId, groupName } = route.params;
  const [stats, setStats] = useState<GamePlayStats | null>(null);

  useEffect(() => {
    getGamePlayStats({ gameId, gameName, groupId }).then((s) => {
      setStats(s);
      navigation.setOptions({ title: s.name });
    });
  }, [gameId, gameName, groupId]);

  if (!stats) return <View style={styles.safe} />;

  return (
    <ScrollView style={styles.safe} contentContainerStyle={styles.content}>
      <Text style={styles.heading}>{stats.name}</Text>
      <Text style={styles.sub}>
        {stats.totalPlays} play{stats.totalPlays === 1 ? '' : 's'} logged
        {groupId != null ? ` · 👥 ${groupName ?? 'this group'} only` : ''}
      </Text>

      {stats.topScores.length > 0 && (
        <>
          <Text style={styles.sectionTitle}>🏅 Top scores</Text>
          {stats.topScores.map((s, i) => (
            <View key={i} style={styles.row}>
              <Text style={styles.medal}>{MEDALS[i] ?? `${i + 1}`}</Text>
              <Text style={styles.name} numberOfLines={1}>{s.name}</Text>
              <View style={styles.scoreRight}>
                <Text style={styles.scoreVal}>{fmtScore(s.score)}</Text>
                <Text style={styles.scoreDate}>{isoToUk(s.playedAt)}</Text>
              </View>
            </View>
          ))}
        </>
      )}

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
  medal: { fontSize: 16, width: 24 },
  name: { color: colors.text, fontSize: 15, flex: 1 },
  record: { color: colors.textMuted, fontSize: 14 },
  scoreRight: { alignItems: 'flex-end' },
  scoreVal: { color: colors.star, fontSize: 16, fontWeight: '800' },
  scoreDate: { color: colors.textMuted, fontSize: 12 },
  legend: { color: colors.textMuted, fontSize: 12, marginTop: spacing.sm, fontStyle: 'italic' },
});
