import React, { useCallback, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation';
import { CollectionStats, getStats } from '../db/plays';
import { getGroups, createGroup } from '../db/groups';
import { Group } from '../types';
import { colors, radius, spacing } from '../theme';

type Nav = NativeStackNavigationProp<RootStackParamList>;

export default function StatsScreen() {
  const navigation = useNavigation<Nav>();
  const [stats, setStats] = useState<CollectionStats | null>(null);
  const [groups, setGroups] = useState<Group[]>([]);
  const [newGroup, setNewGroup] = useState('');

  const loadGroups = useCallback(() => {
    getGroups().then(setGroups).catch(() => {});
  }, []);

  useFocusEffect(
    useCallback(() => {
      getStats().then(setStats).catch((e) => console.warn('stats', e));
      loadGroups();
    }, [loadGroups])
  );

  async function onCreateGroup() {
    if (!newGroup.trim()) return;
    await createGroup(newGroup.trim());
    setNewGroup('');
    loadGroups();
  }

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

        <Section title="👥 Gaming groups">
          <Text style={styles.muted}>
            Track a regular group (e.g. game night). Plays you log to a group can include games you
            don't own.
          </Text>
          {groups.map((g) => (
            <Pressable
              key={g.id}
              style={styles.listRow}
              onPress={() => navigation.navigate('GroupStats', { groupId: g.id })}
            >
              <Text style={styles.listName}>{g.name} ›</Text>
            </Pressable>
          ))}
          <View style={styles.newGroupRow}>
            <TextInput
              style={styles.newGroupInput}
              value={newGroup}
              onChangeText={setNewGroup}
              placeholder="New group name"
              placeholderTextColor={colors.placeholder}
              onSubmitEditing={onCreateGroup}
              returnKeyType="done"
            />
            <Pressable style={styles.newGroupBtn} onPress={onCreateGroup}>
              <Text style={styles.newGroupBtnText}>Add</Text>
            </Pressable>
          </View>
        </Section>

        <Section title="🏆 Top players">
          {stats.topPlayers.length === 0 ? (
            <Text style={styles.muted}>Log some plays to see who's winning.</Text>
          ) : (
            stats.topPlayers.map((p) => (
              <Pressable
                key={p.name}
                style={styles.listRow}
                onPress={() => navigation.navigate('PlayerStats', { name: p.name })}
              >
                <Text style={styles.listName}>{p.name} ›</Text>
                <Text style={styles.listValue}>
                  {p.wins} win{p.wins === 1 ? '' : 's'} · {p.plays} play{p.plays === 1 ? '' : 's'}
                </Text>
              </Pressable>
            ))
          )}
          {stats.playerCount > stats.topPlayers.length && (
            <Pressable
              style={styles.seeAll}
              onPress={() => navigation.navigate('Leaderboard', { kind: 'players' })}
            >
              <Text style={styles.seeAllText}>See all {stats.playerCount} players ›</Text>
            </Pressable>
          )}
        </Section>

        <Section title="🔥 Most played">
          {stats.mostPlayed.length === 0 ? (
            <Text style={styles.muted}>No plays logged yet.</Text>
          ) : (
            stats.mostPlayed.map((g) => (
              <Pressable
                key={g.id}
                style={styles.listRow}
                onPress={() => navigation.navigate('GameStats', { gameId: g.id })}
              >
                <Text style={styles.listName}>{g.name} ›</Text>
                <Text style={styles.listValue}>{g.plays} play{g.plays === 1 ? '' : 's'}</Text>
              </Pressable>
            ))
          )}
          {stats.playedGamesCount > stats.mostPlayed.length && (
            <Pressable
              style={styles.seeAll}
              onPress={() => navigation.navigate('Leaderboard', { kind: 'games' })}
            >
              <Text style={styles.seeAllText}>See all {stats.playedGamesCount} games ›</Text>
            </Pressable>
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
  seeAll: { paddingVertical: spacing.sm },
  seeAllText: { color: colors.primary, fontSize: 14, fontWeight: '600' },
  muted: { color: colors.textMuted, fontSize: 14, marginBottom: spacing.sm },
  newGroupRow: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.md },
  newGroupInput: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    color: colors.text,
    paddingHorizontal: spacing.md,
    paddingVertical: 9,
  },
  newGroupBtn: {
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    paddingHorizontal: spacing.lg,
    justifyContent: 'center',
  },
  newGroupBtnText: { color: colors.primaryText, fontSize: 15, fontWeight: '700' },
  shame: {
    color: colors.textMuted,
    fontSize: 14,
    marginTop: spacing.xl,
    fontStyle: 'italic',
    lineHeight: 20,
  },
});
