import React, { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { RootStackProps } from '../navigation';
import { getPlayerStats, PlayerStats } from '../db/plays';
import { colors, radius, spacing } from '../theme';

export default function PlayerStatsScreen({ route, navigation }: RootStackProps<'PlayerStats'>) {
  const { name } = route.params;
  const [stats, setStats] = useState<PlayerStats | null>(null);

  useEffect(() => {
    navigation.setOptions({ title: name });
    getPlayerStats(name).then(setStats).catch((e) => console.warn('player stats', e));
  }, [name]);

  if (!stats) return <SafeAreaView style={styles.safe} />;

  const losses = stats.totalPlays - stats.wins;

  return (
    <ScrollView style={styles.safe} contentContainerStyle={styles.content}>
      <Text style={styles.heading}>{stats.name}</Text>

      <View style={styles.grid}>
        <Stat label="Plays" value={stats.totalPlays} />
        <Stat label="Wins" value={stats.wins} accent={colors.success} />
        <Stat label="Losses" value={losses} />
        <Stat label="Win rate" value={`${stats.winRate}%`} accent={colors.star} />
      </View>

      <Text style={styles.sectionTitle}>By game</Text>
      {stats.perGame.length === 0 ? (
        <Text style={styles.muted}>No games recorded for this player yet.</Text>
      ) : (
        stats.perGame.map((g) => (
          <View key={g.name} style={styles.row}>
            <Text style={styles.gameName}>{g.name}</Text>
            <Text style={styles.gameStat}>
              {g.wins}/{g.plays} won
            </Text>
          </View>
        ))
      )}
    </ScrollView>
  );
}

function Stat({ label, value, accent }: { label: string; value: number | string; accent?: string }) {
  return (
    <View style={styles.statCard}>
      <Text style={[styles.statValue, accent ? { color: accent } : null]}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  content: { padding: spacing.lg, paddingBottom: spacing.xl * 2 },
  heading: { color: colors.text, fontSize: 26, fontWeight: '700', marginBottom: spacing.lg },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md },
  statCard: {
    flexGrow: 1,
    flexBasis: '45%',
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    alignItems: 'center',
  },
  statValue: { color: colors.text, fontSize: 30, fontWeight: '800' },
  statLabel: { color: colors.textMuted, fontSize: 13, marginTop: 2 },
  sectionTitle: { color: colors.text, fontSize: 17, fontWeight: '700', marginTop: spacing.xl, marginBottom: spacing.sm },
  muted: { color: colors.textMuted, fontSize: 14 },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  gameName: { color: colors.text, fontSize: 15, flex: 1, marginRight: spacing.sm },
  gameStat: { color: colors.textMuted, fontSize: 14 },
});
