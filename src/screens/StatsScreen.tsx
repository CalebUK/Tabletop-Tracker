import React, { useCallback, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { CollectionStats, getStats } from '../db/plays';
import { colors, radius, spacing } from '../theme';

export default function StatsScreen() {
  const [stats, setStats] = useState<CollectionStats | null>(null);

  useFocusEffect(
    useCallback(() => {
      getStats().then(setStats).catch((e) => console.warn('stats', e));
    }, [])
  );

  if (!stats) return <SafeAreaView style={styles.safe} edges={['top']} />;

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.heading}>Stats</Text>

        <View style={styles.grid}>
          <Stat label="Games" value={stats.totalGames} />
          <Stat label="Plays" value={stats.totalPlays} />
          <Stat label="Favorites" value={stats.favorites} />
          <Stat label="Unplayed" value={stats.unplayed} accent />
        </View>

        <Section title="🏆 Top players">
          {stats.topPlayers.length === 0 ? (
            <Text style={styles.muted}>Log some plays to see who's winning.</Text>
          ) : (
            stats.topPlayers.map((p) => (
              <View key={p.name} style={styles.listRow}>
                <Text style={styles.listName}>{p.name}</Text>
                <Text style={styles.listValue}>
                  {p.wins} win{p.wins === 1 ? '' : 's'} · {p.plays} play{p.plays === 1 ? '' : 's'}
                </Text>
              </View>
            ))
          )}
        </Section>

        <Section title="🔥 Most played">
          {stats.mostPlayed.length === 0 ? (
            <Text style={styles.muted}>No plays logged yet.</Text>
          ) : (
            stats.mostPlayed.map((g) => (
              <View key={g.name} style={styles.listRow}>
                <Text style={styles.listName}>{g.name}</Text>
                <Text style={styles.listValue}>{g.plays} play{g.plays === 1 ? '' : 's'}</Text>
              </View>
            ))
          )}
        </Section>

        {stats.unplayed > 0 && (
          <Text style={styles.shame}>
            🛒 You have {stats.unplayed} game{stats.unplayed === 1 ? '' : 's'} you haven't played yet —
            your shelf of shame awaits!
          </Text>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function Stat({ label, value, accent }: { label: string; value: number; accent?: boolean }) {
  return (
    <View style={styles.statCard}>
      <Text style={[styles.statValue, accent && { color: colors.favorite }]}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {children}
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
  statValue: { color: colors.text, fontSize: 32, fontWeight: '800' },
  statLabel: { color: colors.textMuted, fontSize: 13, marginTop: 2 },
  section: { marginTop: spacing.xl },
  sectionTitle: { color: colors.text, fontSize: 17, fontWeight: '700', marginBottom: spacing.sm },
  listRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  listName: { color: colors.text, fontSize: 15 },
  listValue: { color: colors.textMuted, fontSize: 14 },
  muted: { color: colors.textMuted, fontSize: 14 },
  shame: {
    color: colors.textMuted,
    fontSize: 14,
    marginTop: spacing.xl,
    fontStyle: 'italic',
    lineHeight: 20,
  },
});
